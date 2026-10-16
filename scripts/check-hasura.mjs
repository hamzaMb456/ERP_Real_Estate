// Read-only diagnostic: shows which Hasura the scripts talk to, whether the core-records
// tables are tracked there, and what the "manager" role can query. Changes nothing.
//
// Usage (PowerShell):
//   $env:HASURA_ADMIN_SECRET = "<admin secret>"
//   node scripts/check-hasura.mjs

const HASURA_URL =
  process.env.HASURA_URL ?? 'https://rxcugiymqkyghsuixmhi.hasura.eu-central-1.nhost.run';
const SECRET = process.env.HASURA_ADMIN_SECRET;
if (!SECRET) {
  console.error('Set HASURA_ADMIN_SECRET first.');
  process.exit(1);
}

const EXPECTED = [
  'ownerships', 'property_files', 'common_areas', 'current_ownerships', 'property_owners', 'record_gaps',
  'leases', 'lease_units', 'lease_parties', 'lease_rents', 'lease_terms', 'lease_files',
  'lease_overview', 'current_lease_rents', 'unit_current_lease',
  'appointments', 'appointment_participants', 'notifications', 'staff_members', 'calendar_feed',
];
const DEMO_ORG = '11111111-1111-4111-8111-111111111111';

async function post(path, body, headers = {}) {
  const res = await fetch(HASURA_URL + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': SECRET, ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

console.log('Hasura URL:', HASURA_URL, process.env.HASURA_URL ? '<- set by the HASURA_URL environment variable' : '(default)');

const meta = await post('/v1/metadata', { type: 'export_metadata', args: {} });
const tables = (meta.json.sources?.[0]?.tables ?? []).map((t) => `${t.table.schema}.${t.table.name}`);
console.log('Metadata export status:', meta.status, '| tracked tables:', tables.length);
for (const name of EXPECTED) console.log(`  public.${name}: ${tables.includes('public.' + name) ? 'tracked' : 'NOT tracked'}`);
const units = meta.json.sources?.[0]?.tables?.find((t) => t.table.schema === 'public' && t.table.name === 'units');
const managerUnits = units?.select_permissions?.find((p) => p.role === 'manager');
console.log('  manager can read units.common_share:', managerUnits?.permission?.columns?.includes('common_share') ?? false);

const inconsistent = await post('/v1/metadata', { type: 'get_inconsistent_metadata', args: {} });
console.log('Inconsistent metadata objects:', JSON.stringify(inconsistent.json.inconsistent_objects ?? inconsistent.json));

const asManager = await post(
  '/v1/graphql',
  { query: '{ record_gaps_aggregate { aggregate { count } } units(limit: 1) { code common_share } lease_overview(limit: 1) { number status registration_state } }' },
  { 'x-hasura-role': 'manager', 'x-hasura-org-id': DEMO_ORG },
);
console.log('Query as manager:', JSON.stringify(asManager.json.errors ?? asManager.json.data));

const functions = (meta.json.sources?.[0]?.functions ?? []).map((f) => f.function.name);
for (const name of ['activate_lease', 'renew_lease', 'end_lease', 'change_rent', 'expire_overdue_leases', 'generate_daily_notifications']) {
  console.log(`  function ${name}: ${functions.includes(name) ? 'tracked' : 'NOT tracked'}`);
}
