// Applies table tracking, relationships and role permissions for the ERP tables through the
// Hasura Metadata API. Additive and idempotent: it drops then re-creates only the entries listed
// here, and never replaces the rest of the metadata (Nhost auth/storage stay untouched).
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
const USER_VAR = 'X-Hasura-User-Id';
const orgFilter = (column) => ({ [column]: { _eq: ORG_VAR } });
const source = 'default';
const table = (name) => ({ schema: 'public', name });
const storageFiles = { schema: 'storage', name: 'files' };
const BUCKET = 'property-files';

// Roles: org_admin (everything inside the organization), manager (day-to-day work), viewer (read only).
const ROLES = ['org_admin', 'manager', 'viewer'];
const WRITERS = ['org_admin', 'manager'];

// Tables and views created after 0001 that Hasura must track (0001 tables were tracked in the dashboard).
const TRACK = ['ownerships', 'property_files', 'common_areas', 'current_ownerships', 'property_owners', 'record_gaps'];

const OWNERSHIP_COLUMNS = [
  'id', 'organization_id', 'unit_id', 'contact_id', 'share_percent', 'starts_on', 'ends_on', 'notes',
  'created_at', 'updated_at',
];

const SELECT_COLUMNS = {
  organizations: ['id', 'name', 'created_at', 'updated_at'],
  branches: ['id', 'organization_id', 'name', 'city', 'created_at', 'updated_at'],
  properties: [
    'id', 'organization_id', 'branch_id', 'name', 'type', 'address_line', 'city', 'governorate',
    'postal_code', 'latitude', 'longitude', 'archived_at', 'created_at', 'updated_at',
  ],
  units: [
    'id', 'organization_id', 'property_id', 'code', 'type', 'floor', 'rooms', 'surface_m2',
    'rent_amount', 'status', 'common_share', 'archived_at', 'created_at', 'updated_at',
  ],
  contacts: [
    'id', 'organization_id', 'kind', 'full_name', 'email', 'phone', 'national_id', 'address',
    'notes', 'is_organization', 'archived_at', 'created_at', 'updated_at',
  ],
  contact_roles: ['organization_id', 'contact_id', 'role', 'created_at'],
  ownerships: OWNERSHIP_COLUMNS,
  current_ownerships: OWNERSHIP_COLUMNS,
  property_owners: ['organization_id', 'property_id', 'contact_id', 'units_count'],
  record_gaps: ['organization_id', 'entity_type', 'entity_id', 'property_id', 'entity_label', 'property_label', 'gap_code'],
  property_files: [
    'id', 'organization_id', 'property_id', 'unit_id', 'storage_file_id', 'kind', 'category', 'title',
    'is_cover', 'sort_order', 'created_at', 'updated_at',
  ],
  common_areas: ['id', 'organization_id', 'property_id', 'name', 'kind', 'notes', 'created_at', 'updated_at'],
};

// organization_id is never writable by clients: insert sets it from the JWT (preset), update excludes it.
// contacts.is_organization is never writable: only the database creates the self contact.
// properties.type is not updatable: changing it would leave a house's automatic unit wrong.
const WRITE_COLUMNS = {
  branches: { roles: ['org_admin'], insert: ['name', 'city'], update: ['name', 'city'] },
  properties: {
    roles: WRITERS,
    insert: ['branch_id', 'name', 'type', 'address_line', 'city', 'governorate', 'postal_code', 'latitude', 'longitude'],
    update: ['branch_id', 'name', 'address_line', 'city', 'governorate', 'postal_code', 'latitude', 'longitude', 'archived_at'],
  },
  units: {
    roles: WRITERS,
    insert: ['property_id', 'code', 'type', 'floor', 'rooms', 'surface_m2', 'rent_amount', 'status', 'common_share'],
    update: ['code', 'type', 'floor', 'rooms', 'surface_m2', 'rent_amount', 'status', 'common_share', 'archived_at'],
  },
  contacts: {
    roles: WRITERS,
    insert: ['kind', 'full_name', 'email', 'phone', 'national_id', 'address', 'notes'],
    update: ['kind', 'full_name', 'email', 'phone', 'national_id', 'address', 'notes', 'archived_at'],
  },
  contact_roles: { roles: WRITERS, insert: ['contact_id', 'role'], update: null, canDelete: true },
  ownerships: {
    roles: WRITERS,
    insert: ['unit_id', 'contact_id', 'share_percent', 'starts_on', 'ends_on', 'notes'],
    update: ['share_percent', 'starts_on', 'ends_on', 'notes'],
    canDelete: true,
  },
  property_files: {
    roles: WRITERS,
    insert: ['property_id', 'unit_id', 'storage_file_id', 'kind', 'category', 'title', 'is_cover', 'sort_order'],
    update: ['category', 'title', 'is_cover', 'sort_order'],
    canDelete: true,
  },
  common_areas: {
    roles: WRITERS,
    insert: ['property_id', 'name', 'kind', 'notes'],
    update: ['name', 'kind', 'notes'],
    canDelete: true,
  },
};

const tableOrgColumn = (name) => (name === 'organizations' ? 'id' : 'organization_id');

// Relationships (manual configuration because the foreign keys are composite, and views have none).
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
  { type: 'array', table: 'units', name: 'ownerships', to: 'ownerships', map: { id: 'unit_id' } },
  { type: 'object', table: 'ownerships', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'object', table: 'ownerships', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'array', table: 'contacts', name: 'ownerships', to: 'ownerships', map: { id: 'contact_id' } },
  { type: 'array', table: 'units', name: 'current_owners', to: 'current_ownerships', map: { id: 'unit_id' } },
  { type: 'array', table: 'contacts', name: 'current_ownerships', to: 'current_ownerships', map: { id: 'contact_id' } },
  { type: 'object', table: 'current_ownerships', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'object', table: 'current_ownerships', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'array', table: 'properties', name: 'owners', to: 'property_owners', map: { id: 'property_id' } },
  { type: 'object', table: 'property_owners', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'array', table: 'properties', name: 'files', to: 'property_files', map: { id: 'property_id' } },
  { type: 'array', table: 'units', name: 'files', to: 'property_files', map: { id: 'unit_id' } },
  { type: 'array', table: 'properties', name: 'common_areas', to: 'common_areas', map: { id: 'property_id' } },
];

const tracks = TRACK.map((name) => ({ type: 'pg_track_table', args: { source, table: table(name) } }));
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

// Storage: our roles may upload into the property-files bucket, and read/delete a file only when it
// is linked to their organization through property_files (or right after uploading it themselves,
// before the link row exists). Nhost's own storage permissions for other roles are left untouched.
const FILE_COLUMNS = [
  'id', 'bucket_id', 'name', 'size', 'mime_type', 'etag', 'is_uploaded', 'uploaded_by_user_id',
  'metadata', 'created_at', 'updated_at',
];
const linkedToOrg = { property_links: { organization_id: { _eq: ORG_VAR } } };
const ownUpload = { _and: [{ bucket_id: { _eq: BUCKET } }, { uploaded_by_user_id: { _eq: USER_VAR } }] };

// Permissions that use property_links must be dropped before the relationship itself, or re-runs fail.
for (const role of ROLES) {
  for (const t of permissionTypes) {
    drops.push({ type: `pg_drop_${t}_permission`, args: { source, table: storageFiles, role } });
  }
}
drops.push({ type: 'pg_drop_relationship', args: { source, table: storageFiles, relationship: 'property_links' } });
creates.push({
  type: 'pg_create_array_relationship',
  args: {
    source,
    table: storageFiles,
    name: 'property_links',
    using: { manual_configuration: { remote_table: table('property_files'), column_mapping: { id: 'storage_file_id' } } },
  },
});
creates.push({
  type: 'pg_create_select_permission',
  args: { source, table: storageFiles, role: 'viewer', permission: { columns: FILE_COLUMNS, filter: linkedToOrg } },
});
for (const role of WRITERS) {
  creates.push({
    type: 'pg_create_select_permission',
    args: { source, table: storageFiles, role, permission: { columns: FILE_COLUMNS, filter: { _or: [linkedToOrg, ownUpload] } } },
  });
  creates.push({
    type: 'pg_create_insert_permission',
    args: {
      source, table: storageFiles, role,
      permission: {
        columns: ['id', 'bucket_id', 'name', 'size', 'mime_type', 'etag', 'is_uploaded', 'metadata'],
        check: { bucket_id: { _eq: BUCKET } },
        set: { uploaded_by_user_id: USER_VAR.toLowerCase() },
      },
    },
  });
  creates.push({
    type: 'pg_create_update_permission',
    args: {
      source, table: storageFiles, role,
      permission: { columns: ['name', 'size', 'mime_type', 'etag', 'is_uploaded', 'metadata'], filter: ownUpload, check: ownUpload },
    },
  });
  creates.push({
    type: 'pg_create_delete_permission',
    args: { source, table: storageFiles, role, permission: { filter: { _or: [linkedToOrg, ownUpload] } } },
  });
}

async function metadata(body) {
  const res = await fetch(`${HASURA_URL}/v1/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': SECRET },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// Step 0: track new tables and views. "already tracked" is fine on later runs; any other
// error (usually: the table does not exist because migration 0002 was not applied) stops here.
const tracked = await metadata({ type: 'bulk_keep_going', args: tracks });
const trackResults = Array.isArray(tracked.json) ? tracked.json : [tracked.json];
const trackErrors = trackResults
  .map((result, index) => ({ table: TRACK[index], result }))
  .filter(({ result }) => result?.error && result.code !== 'already-tracked');
if (!tracked.ok || trackErrors.length > 0) {
  console.error('Tracking failed. Is db/migrations/0002_core_records.sql applied on this project?');
  for (const { table: name, result } of trackErrors) console.error(`  ${name}: ${result.error}`);
  if (!tracked.ok) console.error(JSON.stringify(tracked.json, null, 2));
  process.exit(1);
}

// Step 1: drop previous versions (errors for "does not exist" are expected on the first run).
await metadata({ type: 'bulk_keep_going', args: drops });

// Step 2: create everything atomically; any error rolls the whole step back.
const result = await metadata({ type: 'bulk', args: creates });
if (!result.ok) {
  console.error('Failed:', result.status, JSON.stringify(result.json, null, 2));
  process.exit(1);
}
const relationshipCount = RELATIONSHIPS.length + 1;
console.log(`Applied ${relationshipCount} relationships and ${creates.length - relationshipCount} permissions.`);
