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
const DRY_RUN = process.argv.includes('--dry-run');
if (!SECRET && !DRY_RUN) {
  console.error('Set HASURA_ADMIN_SECRET first.');
  process.exit(1);
}

const ORG_VAR = 'X-Hasura-Org-Id';
const USER_VAR = 'X-Hasura-User-Id';
const orgFilter = (column) => ({ [column]: { _eq: ORG_VAR } });
const source = 'default';
const table = (name) => ({ schema: 'public', name });
const storageFiles = { schema: 'storage', name: 'files' };
const BUCKETS = ['property-files', 'lease-files'];

// Roles: org_admin (everything inside the organization), manager (day-to-day work), viewer (read only).
const ROLES = ['org_admin', 'manager', 'viewer'];
const WRITERS = ['org_admin', 'manager'];

// Tables and views created after 0001 that Hasura must track (0001 tables were tracked in the dashboard).
const TRACK = [
  'ownerships', 'property_files', 'common_areas', 'current_ownerships', 'property_owners', 'record_gaps',
  'leases', 'lease_units', 'lease_parties', 'lease_rents', 'lease_terms', 'lease_files',
  'lease_overview', 'current_lease_rents', 'unit_current_lease',
  'appointments', 'appointment_participants', 'notifications', 'staff_members', 'calendar_feed',
];

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
  leases: [
    'id', 'organization_id', 'number', 'status', 'start_date', 'end_date', 'payment_day', 'deposit_amount',
    'signed_at', 'registered_at', 'registration_receipt', 'ended_on', 'end_reason', 'archived_at', 'created_at', 'updated_at',
  ],
  lease_units: ['organization_id', 'lease_id', 'unit_id', 'created_at'],
  lease_parties: ['organization_id', 'lease_id', 'contact_id', 'role', 'created_at'],
  lease_rents: ['id', 'organization_id', 'lease_id', 'unit_id', 'effective_from', 'rent_amount', 'charges_amount', 'reason', 'created_at'],
  lease_terms: ['id', 'organization_id', 'lease_id', 'kind', 'start_date', 'end_date', 'recorded_on', 'note', 'created_at'],
  lease_files: ['id', 'organization_id', 'lease_id', 'storage_file_id', 'category', 'title', 'created_at', 'updated_at'],
  lease_overview: [
    'id', 'organization_id', 'number', 'status', 'start_date', 'end_date', 'payment_day', 'deposit_amount',
    'signed_at', 'registered_at', 'registration_receipt', 'ended_on', 'end_reason', 'archived_at',
    'unit_count', 'unit_codes', 'renter_names', 'total_rent', 'total_charges',
    'is_ending_soon', 'in_grace', 'grace_days_left', 'registration_deadline', 'registration_state',
  ],
  current_lease_rents: [
    'organization_id', 'lease_id', 'unit_id', 'effective_from', 'rent_amount', 'charges_amount',
    'next_change_on', 'next_rent_amount', 'next_charges_amount',
  ],
  unit_current_lease: [
    'organization_id', 'unit_id', 'lease_id', 'number', 'start_date', 'end_date', 'renter_names',
    'in_grace', 'is_ending_soon', 'rent_amount', 'charges_amount',
  ],
  appointments: [
    'id', 'organization_id', 'kind', 'title', 'location', 'starts_at', 'ends_at', 'status', 'assigned_user_id',
    'unit_id', 'lease_id', 'notify_by_email', 'reminder_sent_at', 'notes', 'created_at', 'updated_at',
  ],
  appointment_participants: [
    'appointment_id', 'organization_id', 'contact_id', 'role', 'email_status', 'email_error', 'created_at', 'updated_at',
  ],
  notifications: [
    'id', 'organization_id', 'user_id', 'kind', 'title', 'body', 'link', 'lease_id', 'appointment_id',
    'read_at', 'emailed_at', 'email_error', 'created_at',
  ],
  staff_members: ['user_id', 'organization_id', 'display_name', 'email', 'role'],
  calendar_feed: [
    'event_id', 'organization_id', 'source', 'kind', 'title', 'starts_at', 'ends_at', 'all_day', 'status',
    'appointment_id', 'lease_id', 'unit_id', 'branch_id', 'assigned_user_id', 'contact_ids', 'location', 'notify_by_email',
  ],
};

// Select filters other than "my organization": a user sees only their own notifications.
const SELECT_FILTERS = {
  notifications: { _and: [orgFilter('organization_id'), { user_id: { _eq: USER_VAR } }] },
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
  leases: {
    roles: WRITERS,
    insert: ['id', 'start_date', 'end_date', 'payment_day', 'deposit_amount'],
    update: ['start_date', 'end_date', 'payment_day', 'deposit_amount', 'registered_at', 'registration_receipt', 'archived_at'],
  },
  lease_units: { roles: WRITERS, insert: ['lease_id', 'unit_id'], update: null, canDelete: true },
  lease_parties: { roles: WRITERS, insert: ['lease_id', 'contact_id', 'role'], update: null, canDelete: true },
  lease_rents: {
    roles: WRITERS,
    insert: ['lease_id', 'unit_id', 'effective_from', 'rent_amount', 'charges_amount', 'reason'],
    update: null,
  },
  lease_files: {
    roles: WRITERS,
    insert: ['lease_id', 'storage_file_id', 'category', 'title'],
    update: ['category', 'title'],
    canDelete: true,
  },
  // reminder_sent_at is written by the daily job only. Status starts as planned (column default).
  appointments: {
    roles: WRITERS,
    insert: ['id', 'kind', 'title', 'location', 'starts_at', 'ends_at', 'assigned_user_id', 'unit_id', 'lease_id', 'notify_by_email', 'notes'],
    update: ['kind', 'title', 'location', 'starts_at', 'ends_at', 'status', 'assigned_user_id', 'unit_id', 'lease_id', 'notify_by_email', 'notes'],
  },
  // email_status / email_error belong to the e-mail function; the only client update is « Renvoyer » (below).
  appointment_participants: { roles: WRITERS, insert: ['appointment_id', 'contact_id', 'role'], update: null, canDelete: true },
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
  { type: 'array', table: 'leases', name: 'units', to: 'lease_units', map: { id: 'lease_id' } },
  { type: 'object', table: 'lease_units', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'object', table: 'lease_units', name: 'lease', to: 'leases', map: { lease_id: 'id' } },
  { type: 'array', table: 'leases', name: 'parties', to: 'lease_parties', map: { id: 'lease_id' } },
  { type: 'object', table: 'lease_parties', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'object', table: 'lease_parties', name: 'lease', to: 'leases', map: { lease_id: 'id' } },
  { type: 'array', table: 'leases', name: 'rents', to: 'lease_rents', map: { id: 'lease_id' } },
  { type: 'object', table: 'lease_rents', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'array', table: 'leases', name: 'terms', to: 'lease_terms', map: { id: 'lease_id' } },
  { type: 'array', table: 'leases', name: 'files', to: 'lease_files', map: { id: 'lease_id' } },
  { type: 'object', table: 'leases', name: 'overview', to: 'lease_overview', map: { id: 'id' } },
  { type: 'array', table: 'leases', name: 'current_rents', to: 'current_lease_rents', map: { id: 'lease_id' } },
  { type: 'object', table: 'current_lease_rents', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'array', table: 'units', name: 'lease_units', to: 'lease_units', map: { id: 'unit_id' } },
  { type: 'array', table: 'units', name: 'current_lease', to: 'unit_current_lease', map: { id: 'unit_id' } },
  { type: 'array', table: 'contacts', name: 'lease_parties', to: 'lease_parties', map: { id: 'contact_id' } },
  { type: 'array', table: 'appointments', name: 'participants', to: 'appointment_participants', map: { id: 'appointment_id' } },
  { type: 'object', table: 'appointments', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'object', table: 'appointments', name: 'lease', to: 'leases', map: { lease_id: 'id' } },
  { type: 'object', table: 'appointments', name: 'assigned_user', to: 'staff_members', map: { assigned_user_id: 'user_id' } },
  { type: 'object', table: 'appointment_participants', name: 'appointment', to: 'appointments', map: { appointment_id: 'id' } },
  { type: 'object', table: 'appointment_participants', name: 'contact', to: 'contacts', map: { contact_id: 'id' } },
  { type: 'array', table: 'contacts', name: 'appointment_participants', to: 'appointment_participants', map: { id: 'contact_id' } },
  { type: 'array', table: 'leases', name: 'appointments', to: 'appointments', map: { id: 'lease_id' } },
  { type: 'object', table: 'notifications', name: 'lease', to: 'leases', map: { lease_id: 'id' } },
  { type: 'object', table: 'notifications', name: 'appointment', to: 'appointments', map: { appointment_id: 'id' } },
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
        permission: { columns, filter: SELECT_FILTERS[name] ?? orgFilter(orgColumn), allow_aggregations: true },
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

// Notifications: everyone marks their own as read; nothing else is writable from the client.
for (const role of ROLES) {
  creates.push({
    type: 'pg_create_update_permission',
    args: {
      source, table: table('notifications'), role,
      permission: { columns: ['read_at'], filter: SELECT_FILTERS.notifications, check: SELECT_FILTERS.notifications },
    },
  });
}

// « Renvoyer »: writers may only put a participant's e-mail back to pending; the event trigger then resends.
for (const role of WRITERS) {
  creates.push({
    type: 'pg_create_update_permission',
    args: {
      source, table: table('appointment_participants'), role,
      permission: {
        columns: ['email_status'],
        filter: orgFilter('organization_id'),
        check: { _and: [orgFilter('organization_id'), { email_status: { _eq: 'pending' } }] },
      },
    },
  });
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
const linkedToOrg = {
  _or: [
    { property_links: { organization_id: { _eq: ORG_VAR } } },
    { lease_links: { organization_id: { _eq: ORG_VAR } } },
  ],
};
const ownUpload = { _and: [{ bucket_id: { _in: BUCKETS } }, { uploaded_by_user_id: { _eq: USER_VAR } }] };

// Permissions that use property_links must be dropped before the relationship itself, or re-runs fail.
for (const role of ROLES) {
  for (const t of permissionTypes) {
    drops.push({ type: `pg_drop_${t}_permission`, args: { source, table: storageFiles, role } });
  }
}
drops.push({ type: 'pg_drop_relationship', args: { source, table: storageFiles, relationship: 'property_links' } });
drops.push({ type: 'pg_drop_relationship', args: { source, table: storageFiles, relationship: 'lease_links' } });
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
  type: 'pg_create_array_relationship',
  args: {
    source,
    table: storageFiles,
    name: 'lease_links',
    using: { manual_configuration: { remote_table: table('lease_files'), column_mapping: { id: 'storage_file_id' } } },
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
        check: { bucket_id: { _in: BUCKETS } },
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

// Lease functions are exposed as mutations. The writers' functions receive the Hasura session
// (hasura_session) so the database can check the caller's organization and role itself.
// expire_overdue_leases and generate_daily_notifications have no role permission: only the admin secret
// (the daily job) can call them.
const WRITER_FUNCTIONS = ['activate_lease', 'renew_lease', 'end_lease', 'change_rent'];
const ADMIN_FUNCTIONS = ['expire_overdue_leases', 'generate_daily_notifications'];
const fn = (name) => ({ schema: 'public', name });
for (const name of [...WRITER_FUNCTIONS, ...ADMIN_FUNCTIONS]) {
  for (const role of WRITERS) drops.push({ type: 'pg_drop_function_permission', args: { source, function: fn(name), role } });
  drops.push({ type: 'pg_untrack_function', args: { source, function: fn(name) } });
  creates.push({
    type: 'pg_track_function',
    args: {
      source,
      function: fn(name),
      configuration: { exposed_as: 'mutation', ...(WRITER_FUNCTIONS.includes(name) ? { session_argument: 'hasura_session' } : {}) },
    },
  });
}
for (const name of WRITER_FUNCTIONS) {
  for (const role of WRITERS) {
    creates.push({ type: 'pg_create_function_permission', args: { source, function: fn(name), role } });
  }
}

// Every tracked table needs select columns, or nobody could read it.
for (const name of TRACK) {
  if (!SELECT_COLUMNS[name]) throw new Error(`TRACK has ${name} but SELECT_COLUMNS does not.`);
}

if (DRY_RUN) {
  const permissions = creates.filter((entry) => entry.type.endsWith('_permission')).length;
  console.log(
    `Dry run: ${TRACK.length} tracked tables/views, ${RELATIONSHIPS.length + 2} relationships, ` +
      `${permissions} permissions, ${WRITER_FUNCTIONS.length + ADMIN_FUNCTIONS.length} functions. Nothing sent.`,
  );
  process.exit(0);
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

// Each metadata change makes Hasura rebuild its schema, so one request with ~180 operations outlives the
// gateway timeout on a small instance. Send small batches instead; every batch is safe to repeat.
const BATCH = 20;
const batches = (args) => Array.from({ length: Math.ceil(args.length / BATCH) }, (_, i) => args.slice(i * BATCH, (i + 1) * BATCH));

// Step 1: drop previous versions (errors for "does not exist" are expected on the first run).
for (const args of batches(drops)) await metadata({ type: 'bulk_keep_going', args });

// Step 2: create everything, batch by batch; the first error stops the run (rerun after fixing it).
let sent = 0;
for (const args of batches(creates)) {
  const result = await metadata({ type: 'bulk', args });
  if (!result.ok) {
    console.error(`Failed after ${sent} of ${creates.length} operations:`, result.status, JSON.stringify(result.json, null, 2));
    process.exit(1);
  }
  sent += args.length;
  console.log(`  ${sent}/${creates.length}`);
}
const relationshipCount = RELATIONSHIPS.length + 2;
console.log(`Applied ${relationshipCount} relationships and ${creates.length - relationshipCount} permissions and function entries.`);
