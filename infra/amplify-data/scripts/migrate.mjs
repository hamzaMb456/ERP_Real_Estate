#!/usr/bin/env node
// Postgres (Nhost, through Hasura's read-only run_sql) -> DynamoDB (Floci).
//
//   HASURA_ADMIN_SECRET=... node scripts/migrate.mjs [--dry-run] [--api <apiId>]
//
// Idempotent: every item is a full put keyed by its Postgres id, so a rerun (the final delta at
// cutover) overwrites instead of duplicating. Production Postgres is only read.
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { check, SOURCE_TABLES, transform } from './migrate-lib.mjs';
import { useDevTables } from '../lambda/domain/test-env.ts';

const HASURA_URL = process.env.HASURA_URL ?? 'https://rxcugiymqkyghsuixmhi.hasura.eu-central-1.nhost.run';
const SECRET = process.env.HASURA_ADMIN_SECRET;
const BATCH = 25;
const dryRun = process.argv.includes('--dry-run');
const apiAt = process.argv.indexOf('--api');
if (apiAt !== -1) process.env.ERP_API_ID = process.argv[apiAt + 1];
if (!SECRET) {
  console.error('HASURA_ADMIN_SECRET is required');
  process.exit(1);
}

/** One table as JSON, read-only (run_sql with read_only: true runs in a read-only transaction). */
async function extract(tableName) {
  const sql = `select coalesce(json_agg(t), '[]'::json) from (select * from public.${tableName}) t`;
  const response = await fetch(`${HASURA_URL}/v2/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hasura-admin-secret': SECRET },
    body: JSON.stringify({ type: 'run_sql', args: { source: 'default', sql, read_only: true } }),
  });
  if (!response.ok) throw new Error(`extract ${tableName}: HTTP ${response.status} ${await response.text()}`);
  const body = await response.json();
  return JSON.parse(body.result[1][0]);
}

async function writeAll(doc, tableName, items) {
  for (let i = 0; i < items.length; i += BATCH) {
    let requests = items.slice(i, i + BATCH).map((Item) => ({ PutRequest: { Item } }));
    for (let attempt = 0; requests.length > 0; attempt += 1) {
      if (attempt > 8) throw new Error(`${tableName}: unprocessed items after retries`);
      const out = await doc.send(new BatchWriteCommand({ RequestItems: { [tableName]: requests } }));
      requests = out.UnprocessedItems?.[tableName] ?? [];
      if (requests.length) await new Promise((r) => setTimeout(r, 100 * 2 ** attempt));
    }
  }
}

const started = Date.now();
const src = {};
for (const t of SOURCE_TABLES) src[t] = await extract(t);
console.log('extracted:', SOURCE_TABLES.map((t) => `${t}=${src[t].length}`).join(' '));

const { todayTunis } = await import('../lambda/domain/dates.ts');
const result = transform(src, todayTunis());
const problems = check(src, result);
console.log(`transformed: ${Object.entries(result.items).map(([m, rows]) => `${m}=${rows.length}`).join(' ')} Lock=${result.locks.length}`);
if (problems.length) {
  console.error(`check found ${problems.length} problem(s):\n- ${problems.slice(0, 50).join('\n- ')}`);
  process.exit(2);
}
console.log('check: references, share cap, lease overlaps, rent totals OK');
if (dryRun) process.exit(0);

if (!(await useDevTables())) throw new Error('target tables not found (is Floci up / the api deployed?)');
const { doc, table, scanAll } = await import('../lambda/domain/db.ts');
for (const [model, rows] of Object.entries(result.items)) await writeAll(doc, table(model), rows);
await writeAll(doc, table('Lock'), result.locks);

// Read back: every migrated item must be in its table (counts restricted to the migrated ids).
const mismatches = [];
for (const [model, rows] of Object.entries(result.items)) {
  if (rows.length === 0) continue;
  const key = model === 'LeaseUnit' ? (r) => `${r.lease_id}#${r.unit_id}` : model === 'LeaseParty' ? (r) => `${r.lease_id}#${r.contact_id}`
    : model === 'AppointmentParticipant' ? (r) => `${r.appointment_id}#${r.contact_id}` : (r) => r.id;
  const stored = new Set((await scanAll(model)).map(key));
  const absent = rows.filter((r) => !stored.has(key(r))).length;
  if (absent) mismatches.push(`${model}: ${absent} of ${rows.length} missing`);
}
if (mismatches.length) {
  console.error(`read-back mismatches:\n- ${mismatches.join('\n- ')}`);
  process.exit(3);
}

const { resyncAllPublicListings } = await import('../lambda/domain/public-listings.ts');
const listings = await resyncAllPublicListings();
console.log(`loaded and read back OK; website listings: ${listings.listed} (failed ${listings.failed.length}); ${Math.round((Date.now() - started) / 1000)}s`);
