// Applies relationships and role permissions for the foundation tables through the Hasura
// Metadata API. Additive and idempotent: it drops then re-creates only the entries listed here,
// and never replaces the rest of the metadata (Nhost auth/storage stay untouched).
//
// Usage (PowerShell):
//   $env:HASURA_ADMIN_SECRET = "<admin secret from the Nhost dashboard>"
//   node scripts/apply-hasura-permissions.mjs
//
// Optional env: HASURA_URL (default: this project's Hasura endpoint).

const HASURA_URL =
  process.env.HASURA_URL ?? 'https://rxcugiymqkyghsuixmhi.hasura.eu-central-1.nhost.run';
const SECRET = process.env.HASURA_ADMIN_SECRET;
if (!SECRET) {
  console.error('Set HASURA_ADMIN_SECRET first.');
  process.exit(1);
}

const ORG_VAR = 'X-Hasura-Org-Id';
const orgFilter = (column) => ({ [column]: { _eq: ORG_VAR } });
const source = 'default';
const table = (name) => ({ schema: 'public', name });

// Roles: org_admin (everything inside the organization), manager (day-to-day work), viewer (read only).
const ROLES = ['org_admin', 'manager', 'viewer'];
const WRITERS = ['org_admin', 'manager'];

const SELECT_COLUMNS = {
  organizations: ['id', 'name', 'created_at', 'updated_at'],
  branches: ['id', 'organization_id', 'name', 'city', 'created_at', 'updated_at'],
  properties: [
    'id', 'organization_id', 'branch_id', 'name', 'type', 'address_line', 'city', 'governorate',
    'postal_code', 'latitude', 'longitude', 'archived_at', 'created_at', 'updated_at',
  ],
  units: [
    'id', 'organization_id', 'property_id', 'code', 'type', 'floor', 'rooms', 'surface_m2',
    'rent_amount', 'status', 'archived_at', 'created_at', 'updated_at',
  ],
  contacts: [
    'id', 'organization_id', 'kind', 'full_name', 'email', 'phone', 'national_id', 'address',
    'notes', 'created_at', 'updated_at',
  ],
  contact_roles: ['organization_id', 'contact_id', 'role', 'created_at'],
};

// organization_id is never writable by clients: insert sets it from the JWT (preset), update excludes it.
const WRITE_COLUMNS = {
  branches: { roles: ['org_admin'], insert: ['name', 'city'], update: ['name', 'city'] },
  properties: {
    roles: WRITERS,
    insert: ['branch_id', 'name', 'type', 'address_line', 'city', 'governorate', 'postal_code', 'latitude', 'longitude'],
    update: ['branch_id', 'name', 'type', 'address_line', 'city', 'governorate', 'postal_code', 'latitude', 'longitude', 'archived_at'],
  },
  units: {
    roles: WRITERS,
    insert: ['property_id', 'code', 'type', 'floor', 'rooms', 'surface_m2', 'rent_amount', 'status'],
    update: ['code', 'type', 'floor', 'rooms', 'surface_m2', 'rent_amount', 'status', 'archived_at'],
  },
  contacts: {
    roles: WRITERS,
    insert: ['kind', 'full_name', 'email', 'phone', 'national_id', 'address', 'notes'],
    update: ['kind', 'full_name', 'email', 'phone', 'national_id', 'address', 'notes'],
  },
  contact_roles: { roles: WRITERS, insert: ['contact_id', 'role'], update: null, canDelete: true },
};

const tableOrgColumn = (name) => (name === 'organizations' ? 'id' : 'organization_id');

// Relationships (manual configuration because the foreign keys are composite).
const RELATIONSHIPS = [
  { type: 'object', table: 'branches', name: 'organization', to: 'organizations', map: { organization_id: 'id' } },
  { type: 'array', table: 'organizations', name: 'branches', to: 'branches', map: { id: 'organization_id' } },
  { type: 'array', table: 'organizations', name: 'contacts', to: 'contacts', map: { id: 'organization_id' } },
  { type: 'object', table: 'properties', name: 'branch', to: 'branches', map: { branch_id: 'id' } },
  { type: 'array', table: 'branches', name: 'properties', to: 'properties', map: { id: 'branch_id' } },
  { type: 'object', table: 'units', name: 'property', to: 'properties', map: { property_id: 'id' } },
  { type: 'array', table: 'properties', name: 'units', to: 'units', map: { id: 'property_id' } },
  { type: 'object', table: 'contact_roles', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'array', table: 'contacts', name: 'roles', to: 'contact_roles', map: { id: 'contact_id' } },
];

const drops = [];
const creates = [];

for (const r of RELATIONSHIPS) {
  drops.push({ type: 'pg_drop_relationship', args: { source, table: table(r.table), relationship: r.name } });
  creates.push({
    type: `pg_create_${r.type}_relationship`,
    args: {
      source,
      table: table(r.table),
      name: r.name,
      using: { manual_configuration: { remote_table: table(r.to), column_mapping: r.map } },
    },
  });
}

const permissionTypes = ['select', 'insert', 'update', 'delete'];
for (const name of Object.keys(SELECT_COLUMNS)) {
  for (const role of ROLES) {
    for (const t of permissionTypes) {
      drops.push({ type: `pg_drop_${t}_permission`, args: { source, table: table(name), role } });
    }
  }
}

for (const [name, columns] of Object.entries(SELECT_COLUMNS)) {
  const orgColumn = tableOrgColumn(name);
  for (const role of ROLES) {
    creates.push({
      type: 'pg_create_select_permission',
      args: {
        source, table: table(name), role,
        permission: { columns, filter: orgFilter(orgColumn), allow_aggregations: true },
      },
    });
  }
}

for (const [name, w] of Object.entries(WRITE_COLUMNS)) {
  for (const role of w.roles) {
    creates.push({
      type: 'pg_create_insert_permission',
      args: {
        source, table: table(name), role,
        permission: {
          columns: w.insert,
          check: orgFilter('organization_id'),
          set: { organization_id: ORG_VAR.toLowerCase() },
        },
      },
    });
    if (w.update) {
      creates.push({
        type: 'pg_create_update_permission',
        args: {
          source, table: table(name), role,
          permission: { columns: w.update, filter: orgFilter('organization_id'), check: orgFilter('organization_id') },
        },
      });
    }
    if (w.canDelete) {
      creates.push({
        type: 'pg_create_delete_permission',
        args: { source, table: table(name), role, permission: { filter: orgFilter('organization_id') } },
      });
    }
  }
}

// The organization itself: only an org_admin may rename it. No insert/delete from clients.
creates.push({
  type: 'pg_create_update_permission',
  args: {
    source, table: table('organizations'), role: 'org_admin',
    permission: { columns: ['name'], filter: orgFilter('id'), check: orgFilter('id') },
  },
});

async function metadata(body) {
  const res = await fetch(`${HASURA_URL}/v1/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': SECRET },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// Step 1: drop previous versions (errors for "does not exist" are expected on the first run).
await metadata({ type: 'bulk_keep_going', args: drops });

// Step 2: create everything atomically; any error rolls the whole step back.
const result = await metadata({ type: 'bulk', args: creates });
if (!result.ok) {
  console.error('Failed:', result.status, JSON.stringify(result.json, null, 2));
  process.exit(1);
}
console.log(`Applied ${RELATIONSHIPS.length} relationships and ${creates.length - RELATIONSHIPS.length} permissions.`);
