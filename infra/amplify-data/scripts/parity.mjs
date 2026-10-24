#!/usr/bin/env node
// Parity check after a migration rehearsal: run the web's own read queries against Hasura (as a
// manager of the organization) and against the AppSync resolvers, and compare the answers, taking
// Hasura's shape as the reference (extra fields on our side are fine, different values are not).
//
//   HASURA_ADMIN_SECRET=... node scripts/parity.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { useDevTables } from '../lambda/domain/test-env.ts';

const HASURA_URL = process.env.HASURA_URL ?? 'https://rxcugiymqkyghsuixmhi.hasura.eu-central-1.nhost.run';
const SECRET = process.env.HASURA_ADMIN_SECRET;
const WEB_SRC = join(import.meta.dirname, '..', '..', '..', 'web', 'src');
if (!SECRET) throw new Error('HASURA_ADMIN_SECRET is required');

function webQueries() {
  const out = new Map();
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f) && !/\.test\./.test(f)) {
        for (const m of readFileSync(p, 'utf8').matchAll(/`\s*(query\s+([A-Za-z0-9_]+)[\s\S]*?)`/g)) if (!m[1].includes('${')) out.set(m[2], m[1]);
      }
    }
  };
  walk(WEB_SRC);
  return out;
}

async function hasura(query, variables, session) {
  const response = await fetch(`${HASURA_URL}/v1/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', 'x-hasura-admin-secret': SECRET,
      'x-hasura-role': session.role, 'x-hasura-org-id': session.orgId, 'x-hasura-user-id': session.userId,
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();
  if (body.errors) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data;
}

const asNumber = (v) => (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v);
const asInstant = (v) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? Date.parse(v) : v);

/** First path where `ours` differs from `expected` (only keys present in `expected` are compared). */
function diff(expected, ours, path = '$') {
  if (Array.isArray(expected)) {
    if (!Array.isArray(ours)) return `${path}: expected array`;
    if (expected.length !== ours.length) return `${path}: length ${expected.length} vs ${ours.length}`;
    const inOrder = expected.every((e, i) => diff(e, ours[i]) === null);
    if (inOrder) return null;
    // Nested lists without order_by have no defined order in Postgres: compare them as sets.
    const unmatched = [...ours];
    for (let i = 0; i < expected.length; i += 1) {
      const at = unmatched.findIndex((o) => diff(expected[i], o) === null);
      if (at === -1) return diff(expected[i], ours[i], `${path}[${i}]`);
      unmatched.splice(at, 1);
    }
    return null;
  }
  if (expected && typeof expected === 'object') {
    if (!ours || typeof ours !== 'object') return `${path}: expected object, got ${JSON.stringify(ours)}`;
    for (const k of Object.keys(expected)) {
      // Notification ids are <user>#<dedupe_key> now (the web only hands them back to mark read).
      if (k === 'id' && path.startsWith('$.notifications')) continue;
      const d = diff(expected[k], ours[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }
  const [a, b] = [asInstant(asNumber(expected)), asInstant(asNumber(ours ?? null))];
  return a === b ? null : `${path}: ${JSON.stringify(expected)} vs ${JSON.stringify(ours)}`;
}

if (!(await useDevTables())) throw new Error('target tables not found');
const { dispatch } = await import('../lambda/api/dispatch.ts');
const org = (await hasura('query { organizations { id } }', {}, { role: 'admin', orgId: '', userId: '' }).catch(() => null))?.organizations?.[0];
const staff = await hasura('query { staff_members(limit: 1, where: { role: { _eq: "org_admin" } }) { user_id organization_id } }', {}, { role: 'admin', orgId: '', userId: '' });
const session = { role: 'org_admin', orgId: org.id, userId: staff.staff_members[0]?.user_id ?? '' };
const ids = await hasura('query { properties(limit: 1, order_by: { name: asc }) { id } units(limit: 1, order_by: { code: asc }) { id } leases(limit: 1, order_by: { number: asc }) { id } contacts(limit: 1, order_by: { full_name: asc }) { id } }', {}, session);
const vars = {
  Property: { id: ids.properties[0]?.id }, PropertyForEdit: { id: ids.properties[0]?.id }, Unit: { id: ids.units[0]?.id },
  Lease: { id: ids.leases[0]?.id }, DraftLease: { id: ids.leases[0]?.id }, Contact: { id: ids.contacts[0]?.id }, ContactForEdit: { id: ids.contacts[0]?.id },
  UnitOwnerships: { unitId: ids.units[0]?.id }, ContactOwnerships: { contactId: ids.contacts[0]?.id }, CommonAreas: { propertyId: ids.properties[0]?.id },
  LeaseFormUnits: { keep: [] }, UnitLease: { id: ids.units[0]?.id }, LeaseDocuments: { id: ids.leases[0]?.id }, LeaseCalendar: { id: ids.leases[0]?.id },
  ContactLeases: { id: ids.contacts[0]?.id, role: 'renter' }, ContactAppointments: { contactId: ids.contacts[0]?.id },
};
const SKIP = new Set(['Dashboard', 'MyVisits', 'ListingsFor', 'StorageFileOwnership', 'TakenVisitSlots', 'ContactDuplicates', 'Photos', 'Documents', 'CalendarFeedRows', 'Appointment']);

let ok = 0;
const failures = [];
for (const [name, query] of webQueries()) {
  if (SKIP.has(name) || name.startsWith('Public')) continue;
  const variables = vars[name] ?? {};
  try {
    const expected = await hasura(query, variables, session);
    const ours = JSON.parse(await dispatch('run', { op: name, variables: JSON.stringify(variables) }, session));
    const d = diff(expected, ours);
    if (d) failures.push(`${name}: ${d}`);
    else ok += 1;
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
  }
}
console.log(`parity: ${ok} identical, ${failures.length} different`);
for (const f of failures) console.log(`- ${f}`);
