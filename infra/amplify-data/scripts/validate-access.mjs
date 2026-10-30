#!/usr/bin/env node
// P6 access validation for a deployed stack. READ-ONLY: nothing is written.
//   node scripts/validate-access.mjs <apiId>
//
// 1. Role matrix: every operation x every role is sent to the DEPLOYED api Lambda with deliberately
//    invalid JSON variables. The dispatcher checks the role before it parses the variables, so a
//    denied role answers permission_denied and an allowed role fails on the JSON parse; no operation
//    body ever runs, so no mutation can write.
// 2. Authorizer: unsigned, garbage, forged and expired tokens must be rejected.
// 3. AppSync over HTTP: no / garbage / forged token = 401; public token is limited to public operations.
// 4. Cross-tenant: every staff query is run with real ids as a real-org caller (positive control)
//    and as an admin of a made-up organization; the second must never see a real record.
// 5. Client (role user) scoping on MyVisits.
import { randomUUID } from 'node:crypto';
import { DynamoDBClient, ListTablesCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { InvokeCommand, LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { SignJWT, generateKeyPair } from 'jose';
import { OPS } from '../lambda/api/ops/index.ts';

process.env.AWS_ENDPOINT_URL ??= 'http://localhost:4566';
process.env.AWS_REGION ??= 'us-east-1';
process.env.AWS_ACCESS_KEY_ID ??= 'test';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test';

const apiId = process.argv[2];
if (!apiId) {
  console.error('usage: node scripts/validate-access.mjs <apiId>');
  process.exit(1);
}

const lambda = new LambdaClient({});
const dynamo = new DynamoDBClient({});
const ENDPOINT = `${process.env.AWS_ENDPOINT_URL}/v1/apis/${apiId}/graphql`;
const ROLES = ['public', 'user', 'org_admin', 'manager', 'viewer'];
const STAFF = ['org_admin', 'manager', 'viewer'];
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const SECRET_KEYS = ['full_name', 'email', 'phone', 'display_name', 'name', 'title', 'address', 'description'];

const failures = [];
const counts = {};
function check(group, ok, message) {
  counts[group] ??= { pass: 0, fail: 0 };
  if (ok) counts[group].pass += 1;
  else {
    counts[group].fail += 1;
    failures.push(`[${group}] ${message}`);
  }
}

async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  return out;
}

// ---- deployed functions --------------------------------------------------------------------------
async function listFunctions() {
  const all = [];
  let Marker;
  do {
    const page = await lambda.send(new ListFunctionsCommand({ Marker }));
    all.push(...(page.Functions ?? []));
    Marker = page.NextMarker;
  } while (Marker);
  return all;
}

async function findFunctions() {
  const all = await listFunctions();
  const api = all.find((fn) => /-ApiF/.test(fn.FunctionName) && JSON.stringify(fn.Environment?.Variables ?? {}).includes(apiId));
  if (!api) throw new Error(`no api Lambda found for ${apiId}`);
  // The authorizer shares the stack prefix of the api Lambda.
  const prefix = api.FunctionName.replace(/-ApiF.*$/, '');
  const authorizer = all.find((fn) => fn.FunctionName.startsWith(`${prefix}-Authorizer`));
  return { api: api.FunctionName, authorizer: authorizer?.FunctionName ?? null };
}

async function invoke(functionName, payload) {
  const res = await lambda.send(new InvokeCommand({ FunctionName: functionName, Payload: Buffer.from(JSON.stringify(payload)) }));
  const text = Buffer.from(res.Payload ?? []).toString();
  let body = text;
  try { body = JSON.parse(text); } catch { /* keep text */ }
  if (res.FunctionError) return { error: String(body?.errorMessage ?? text) };
  return { value: body };
}

const caller = (role, orgId, userId) => ({ role, orgId, userId });
async function callOp(fn, who, op, variables, fieldName) {
  const kind = OPS[op]?.kind === 'mutation' ? 'exec' : 'run';
  const r = await invoke(fn, {
    fieldName: fieldName ?? kind,
    arguments: { op, variables: typeof variables === 'string' ? variables : JSON.stringify(variables ?? {}) },
    identity: { resolverContext: who },
  });
  if (r.error) return r;
  try { return { value: JSON.parse(r.value) }; } catch { return { error: `unparseable: ${String(r.value).slice(0, 80)}` }; }
}

// ---- 1. role matrix -------------------------------------------------------------------------------
async function roleMatrix(fn, orgId) {
  const jobs = [];
  for (const [name, op] of Object.entries(OPS)) {
    for (const role of [...ROLES, 'admin', '']) jobs.push({ name, op, role });
  }
  await inBatches(jobs, 12, async ({ name, op, role }) => {
    const who = caller(role, STAFF.includes(role) ? orgId : '', randomUUID());
    const r = await callOp(fn, who, name, '{');
    const allowed = op.roles.includes(role);
    const denied = Boolean(r.error && /permission_denied/.test(r.error));
    check('role-matrix', allowed ? !denied && Boolean(r.error) : denied, `${name} as "${role || '(none)'}": expected ${allowed ? 'allowed' : 'permission_denied'}, got ${JSON.stringify(r).slice(0, 120)}`);
  });
  // Wrong field for the operation kind never reaches the body.
  await inBatches(Object.entries(OPS), 12, async ([name, op]) => {
    const wrong = op.kind === 'query' ? 'exec' : 'run';
    const r = await callOp(fn, caller('org_admin', orgId, randomUUID()), name, '{', wrong);
    check('kind-mismatch', Boolean(r.error && /unknown_operation/.test(r.error)), `${name} via ${wrong}: ${JSON.stringify(r).slice(0, 120)}`);
  });
  const unknown = await callOp(fn, caller('org_admin', orgId, randomUUID()), 'NoSuchOperation', '{', 'run');
  check('kind-mismatch', Boolean(unknown.error && /unknown_operation/.test(unknown.error)), 'unknown operation name is rejected');
}

// ---- 2. authorizer --------------------------------------------------------------------------------
async function authorizerChecks(fn, orgId) {
  const { privateKey } = await generateKeyPair('RS256');
  const now = Math.floor(Date.now() / 1000);
  const claims = { 'custom:role': 'org_admin', 'custom:org_id': orgId };
  const forged = await new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'forged' }).setSubject(randomUUID()).setExpirationTime(now + 600).sign(privateKey);
  const expired = await new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'forged' }).setSubject(randomUUID()).setExpirationTime(now - 600).sign(privateKey);
  const unsigned = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...claims, sub: randomUUID(), exp: now + 600 })).toString('base64url')}.`;
  const hs256 = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).setSubject(randomUUID()).setExpirationTime(now + 600).sign(new TextEncoder().encode('x'.repeat(32)));
  const rejected = { 'empty token': '', 'garbage token': 'not-a-jwt', 'forged RS256 token': forged, 'expired forged token': expired, 'alg none token': unsigned, 'HS256 token': hs256, 'Bearer garbage': 'Bearer abc.def.ghi' };
  for (const [label, token] of Object.entries(rejected)) {
    const r = await invoke(fn, { authorizationToken: token });
    check('authorizer', r.value?.isAuthorized === false, `${label} must be rejected, got ${JSON.stringify(r).slice(0, 120)}`);
  }
  const pub = await invoke(fn, { authorizationToken: 'public' });
  check('authorizer', pub.value?.isAuthorized === true && pub.value.resolverContext?.role === 'public' && pub.value.resolverContext?.orgId === '', 'public token maps to role public with no org');
}

// ---- 3. AppSync over HTTP -------------------------------------------------------------------------
async function http(token, op, variables) {
  const headers = { 'Content-Type': 'application/json' };
  if (token !== undefined) headers.Authorization = token;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: 'query Run($op: String!, $v: AWSJSON) { run(op: $op, variables: $v) }', variables: { op, v: JSON.stringify(variables ?? {}) } }),
  });
  let json = null;
  try { json = await res.json(); } catch { /* not json */ }
  return { status: res.status, json };
}

async function httpChecks(orgId, fakeOrg) {
  const { privateKey } = await generateKeyPair('RS256');
  const forged = await new SignJWT({ 'custom:role': 'org_admin', 'custom:org_id': orgId })
    .setProtectedHeader({ alg: 'RS256', kid: 'forged' }).setSubject(randomUUID()).setExpirationTime(Math.floor(Date.now() / 1000) + 600).sign(privateKey);
  for (const [label, token] of [['no Authorization header', undefined], ['garbage token', 'garbage'], ['forged JWT', forged]]) {
    const r = await http(token, 'Contacts', {});
    check('http', r.status === 401, `${label} must be 401, got ${r.status}`);
  }
  const staffAsPublic = await http('public', 'Contacts', {});
  check('http', /permission_denied/.test(JSON.stringify(staffAsPublic.json?.errors ?? '')) && !staffAsPublic.json?.data?.run, 'public token on a staff operation is denied');
  check('error-leak', !/\/var\/task|node_modules|\bat [\w.$<>]+ \(|\.(js|ts):\d+/.test(JSON.stringify(staffAsPublic.json ?? '')), 'AppSync error replies must not carry Lambda stack frames or file paths');
  const broken = await http('public', 'PublicLatestListings', { where: 'not-an-object' });
  check('error-leak', !/\/var\/task|node_modules|\bat [\w.$<>]+ \(|\.(js|ts):\d+/.test(JSON.stringify(broken.json ?? '')), 'an unexpected resolver error must not carry frames or file paths either');
  const noOrg = await http('public', 'PublicLatestListings', { where: {}, orderBy: [], limit: 5 });
  check('http', /public_org_required/.test(JSON.stringify(noOrg.json?.errors ?? '')), 'public listings without an organization are refused');
  const wherePublic = (org) => ({ where: { _and: [{ organization_id: { _eq: org } }] }, orderBy: [{ published_at: 'desc_nulls_last' }], limit: 20 });
  const real = await http('public', 'PublicLatestListings', wherePublic(orgId));
  const realListings = JSON.parse(real.json?.data?.run ?? '{"listings":[]}').listings;
  check('http', realListings.length > 0, 'positive control: public listings of the real organization are visible');
  const fake = await http('public', 'PublicLatestListings', wherePublic(fakeOrg));
  const fakeListings = JSON.parse(fake.json?.data?.run ?? '{"listings":[]}').listings;
  check('http', fakeListings.length === 0, 'public listings of an unknown organization are empty');
  const leaked = realListings.some((l) => Object.keys(l).some((k) => /owner|email|phone|client_user|tenant/i.test(k)));
  check('http', !leaked, 'public listing rows expose no owner / contact / client fields');
}

// ---- data under test ------------------------------------------------------------------------------
async function loadItems() {
  const names = [];
  let ExclusiveStartTableName;
  do {
    const page = await dynamo.send(new ListTablesCommand({ ExclusiveStartTableName }));
    names.push(...(page.TableNames ?? []));
    ExclusiveStartTableName = page.LastEvaluatedTableName;
  } while (ExclusiveStartTableName);
  const items = {};
  for (const table of names.filter((n) => n.split('-')[1] === apiId)) {
    const rows = [];
    let ExclusiveStartKey;
    do {
      const page = await dynamo.send(new ScanCommand({ TableName: table, ExclusiveStartKey }));
      rows.push(...(page.Items ?? []).map((i) => unmarshall(i)));
      ExclusiveStartKey = page.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    items[table.split('-')[0]] = rows;
  }
  return items;
}

function secretsOf(items) {
  const uuids = new Set();
  const strings = new Set();
  for (const rows of Object.values(items)) {
    for (const row of rows) {
      for (const id of JSON.stringify(row).match(UUID) ?? []) uuids.add(id.toLowerCase());
      for (const key of SECRET_KEYS) if (typeof row[key] === 'string' && row[key].length >= 5) strings.add(row[key]);
    }
  }
  return { uuids, strings: [...strings] };
}

function leaksIn(text, secrets, echoed) {
  const found = [];
  for (const id of new Set((text.match(UUID) ?? []).map((s) => s.toLowerCase()))) if (secrets.uuids.has(id) && !echoed.has(id)) found.push(id);
  for (const s of secrets.strings) if (text.includes(s)) found.push(s);
  return found;
}

// ---- 4. cross-tenant ------------------------------------------------------------------------------
async function crossTenant(fn, items, orgId, fakeOrg, secrets) {
  const first = (model) => items[model]?.[0]?.id;
  const P = first('Property'), U = first('Unit'), C = first('Contact'), L = first('Lease'), A = first('Appointment');
  const staffQueries = Object.entries(OPS).filter(([, op]) => op.kind === 'query' && op.roles.length === 3 && STAFF.every((r) => op.roles.includes(r)));
  // Notifications are per user: use a user that really has some.
  const userId = items.Notification?.[0]?.user_id ?? randomUUID();
  const realCaller = (role) => caller(role, orgId, userId);
  const fakeCaller = caller('org_admin', fakeOrg, randomUUID());
  const day = new Date().toISOString().slice(0, 10);
  const bundle = (P, U, C, L, A) => ({
    unitId: U, propertyId: P, contactId: C, leaseId: L, appointmentId: A, key: first('StorageFile'),
    limit: 50, offset: 0, orderBy: [], today: day, dayStart: '2000-01-01', dayEnd: '2100-01-01', from: '2000-01-01', to: '2100-01-01',
  });
  const plain = bundle(P, U, C, L, A);
  // A second bundle built from rows that have links (leased unit, tenant).
  const linked = bundle(P,items.LeaseUnit?.[0]?.unit_id ?? U, items.LeaseParty?.[0]?.contact_id ?? C, items.LeaseUnit?.[0]?.lease_id ?? L, A);
  const idsOf = (b) => [b.propertyId, b.unitId, b.contactId, b.leaseId, b.appointmentId, first('Ownership'), first('RentalRequest'), first('VisitRequest')].filter(Boolean);
  // Every id kind in turn as `id`, plus where-filters by target for the file / document queries.
  const varSets = [plain, linked].flatMap((b, n) => [
    ...idsOf(b).map((id, i) => ({ label: `bundle ${n} id kind ${i}`, vars: { ...b, ids: idsOf(b), id, where: {} } })),
    ...[['property_id', b.propertyId], ['unit_id', b.unitId], ['lease_id', b.leaseId]].filter(([, v]) => v)
      .map(([k, v]) => ({ label: `bundle ${n} where ${k}`, vars: { ...b, ids: idsOf(b), id: b.propertyId, where: { [k]: { _eq: v } } } })),
  ]);
  let exercised = 0;
  const unexercised = [];
  const stats = { ops: staffQueries.length, calls: 0, errors: 0 };

  await inBatches(staffQueries, 6, async ([name]) => {
    let exercisedThisOp = false;
    for (const { label, vars } of varSets) {
      const echoed = new Set(Object.values(vars).flat().filter((v) => typeof v === 'string').map((v) => v.toLowerCase()));
      const [real, ...roles] = await Promise.all([callOp(fn, realCaller('org_admin'), name, vars), callOp(fn, realCaller('manager'), name, vars), callOp(fn, realCaller('viewer'), name, vars)]);
      const fake = await callOp(fn, fakeCaller, name, vars);
      stats.calls += 2;
      if (real.error) stats.errors += 1;
      const realText = JSON.stringify(real.value ?? '');
      if (!real.error && leaksIn(realText, secrets, new Set()).length > 0) exercisedThisOp = true;
      if (!real.error) {
        const same = roles.every((r) => !r.error && JSON.stringify(r.value) === realText);
        check('staff-parity', same, `${name} (${label}): manager/viewer must see what org_admin sees`);
      }
      const found = fake.error ? [] : leaksIn(JSON.stringify(fake.value ?? ''), secrets, echoed);
      check('cross-tenant', found.length === 0, `${name} (${label}) leaked to another org: ${found.slice(0, 3).join(', ')}`);
    }
    if (exercisedThisOp) exercised += 1;
    else unexercised.push(name);
  });
  stats.exercised = exercised;
  stats.unexercised = unexercised.sort();
  return stats;
}

// ---- 5. client scoping ----------------------------------------------------------------------------
async function clientScoping(fn, items) {
  const visit = (items.VisitRequest ?? []).find((v) => v.client_user_id);
  if (!visit) {
    console.log('client scoping: no VisitRequest with a client_user_id, skipped');
    return;
  }
  const own = await callOp(fn, caller('user', '', visit.client_user_id), 'MyVisits', {});
  check('client', !own.error && JSON.stringify(own.value).includes(visit.id), 'positive control: a client sees their own visit request');
  const other = await callOp(fn, caller('user', '', randomUUID()), 'MyVisits', {});
  check('client', !other.error && !JSON.stringify(other.value).includes(visit.id), 'another client never sees that visit request');
  const staff = await callOp(fn, caller('org_admin', visit.organization_id ?? '', randomUUID()), 'MyVisits', '{', 'run');
  check('client', Boolean(staff.error && /permission_denied/.test(staff.error)), 'staff cannot call the client-only MyVisits');
}

// ---- main -----------------------------------------------------------------------------------------
const fns = await findFunctions();
console.log(`api Lambda: ${fns.api}\nauthorizer: ${fns.authorizer}\n${Object.keys(OPS).length} operations x ${ROLES.length + 2} roles`);
const items = await loadItems();
const orgId = items.Organization?.[0]?.id;
if (!orgId) throw new Error('no Organization row on this stack');
const fakeOrg = randomUUID();
const secrets = secretsOf(items);
console.log(`real org ${orgId}; ${secrets.uuids.size} record ids and ${secrets.strings.length} names/emails/titles to watch for`);

await roleMatrix(fns.api, orgId);
if (fns.authorizer) await authorizerChecks(fns.authorizer, orgId);
else check('authorizer', false, 'authorizer Lambda not found');
await httpChecks(orgId, fakeOrg);
const stats = await crossTenant(fns.api, items, orgId, fakeOrg, secrets);
await clientScoping(fns.api, items);

console.log(`\ncross-tenant coverage: ${stats.exercised}/${stats.ops} staff queries returned real data for the real org (positive control); ${stats.calls} calls, ${stats.errors} errored for missing variables\nnot exercised with real data (empty tables or variables this script cannot guess): ${stats.unexercised.join(', ') || 'none'}`);
for (const [group, c] of Object.entries(counts)) console.log(`${group.padEnd(14)} ${String(c.pass).padStart(5)} pass  ${String(c.fail).padStart(4)} fail`);
if (failures.length) {
  console.log(`\n${failures.length} FAILURES`);
  for (const f of failures.slice(0, 60)) console.log(`- ${f}`);
  process.exit(1);
}
console.log('\nall access checks passed');
