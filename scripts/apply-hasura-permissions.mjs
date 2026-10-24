// Applies table tracking, relationships and role permissions for the ERP tables through the
// Hasura Metadata API. Additive and idempotent: it drops then re-creates only the entries listed
// here, and never replaces the rest of the metadata (Nhost auth/storage stay untouched).
// It reads the current metadata first and sends only what differs (a small instance cannot rebuild its schema hundreds of
// times in a row); pass --full to drop and recreate every entry instead. --dry-run sends nothing.
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
const storageBuckets = { schema: 'storage', name: 'buckets' };
// What Nhost storage needs to read, as the public role, to serve a published photo (see the permission below).
const PUBLIC_FILE_COLUMNS = ['id', 'bucket_id', 'name', 'size', 'mime_type', 'etag', 'is_uploaded', 'metadata', 'uploaded_by_user_id', 'created_at', 'updated_at'];
const PUBLIC_BUCKET_COLUMNS = [
  'id', 'download_expiration', 'min_upload_file_size', 'max_upload_file_size', 'cache_control', 'presigned_urls_enabled',
  'created_at', 'updated_at',
];
const BUCKETS = ['property-files', 'lease-files'];

// Roles: org_admin (everything inside the organization), manager (day-to-day work), viewer (read only).
const ROLES = ['org_admin', 'manager', 'viewer'];
const WRITERS = ['org_admin', 'manager'];
// Role of the public site: Hasura's unauthenticated role (Nhost's default for unauthenticated requests). It gets select on
// the public listing views and on the unit photo files of units that are on the website, and nothing else.
const PUBLIC_ROLE = 'public';

// Tables and views created after 0001 that Hasura must track (0001 tables were tracked in the dashboard).
const TRACK = [
  'ownerships', 'property_files', 'common_areas', 'current_ownerships', 'property_owners', 'record_gaps',
  'leases', 'lease_units', 'lease_parties', 'lease_rents', 'lease_terms', 'lease_files',
  'lease_overview', 'current_lease_rents', 'unit_current_lease',
  'appointments', 'appointment_participants', 'notifications', 'staff_members', 'calendar_feed',
  'public_listings', 'public_listing_photos',
  'rental_requests', 'visit_requests', 'request_receipt', 'public_taken_visit_slots',
];

// Tracked before 0006 and unused since: units go on the site by themselves (see db/migrations/0006_units_on_website.sql).
// Untracked with cascade, which also removes its permissions and the relationships that point at it. The table itself
// stays in the database.
const UNTRACK = ['listings'];

const OWNERSHIP_COLUMNS = [
  'id', 'organization_id', 'unit_id', 'contact_id', 'share_percent', 'starts_on', 'ends_on', 'notes',
  'created_at', 'updated_at',
];

// Details a visitor reads on the public page (migration 0007): bien-level and unit-level, writable like the other
// website fields.
const PROPERTY_DETAIL_COLUMNS = ['year_built', 'floors_count', 'neighbourhood_description'];
const UNIT_DETAIL_COLUMNS = [
  'bedrooms', 'bathrooms', 'parking_spaces', 'property_condition', 'deposit_months', 'pets_allowed', 'legal_status',
  'virtual_tour_url', 'orientation', 'outdoor_area_m2', 'energy_class', 'min_lease_months', 'charges_included',
  'reservation_deposit', 'reservation_days',
];

const SELECT_COLUMNS = {
  organizations: ['id', 'name', 'visit_payment_method', 'created_at', 'updated_at'],
  branches: ['id', 'organization_id', 'name', 'city', 'created_at', 'updated_at'],
  properties: [
    'id', 'organization_id', 'branch_id', 'name', 'type', 'address_line', 'city', 'governorate',
    'postal_code', 'latitude', 'longitude', ...PROPERTY_DETAIL_COLUMNS, 'archived_at', 'created_at', 'updated_at',
  ],
  units: [
    'id', 'organization_id', 'property_id', 'code', 'type', 'floor', 'rooms', 'surface_m2',
    'rent_amount', 'status', 'common_share', 'title', 'description', 'sale_price', 'charges', 'available_from',
    'furnished', 'amenities', 'show_on_website', ...UNIT_DETAIL_COLUMNS, 'archived_at', 'created_at', 'updated_at',
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
  // Requests from visitors of the public site (migration 0008): staff read them and answer through status and note.
  rental_requests: [
    'id', 'organization_id', 'unit_id', 'start_date', 'duration_months', 'full_name', 'phone', 'email', 'message',
    'status', 'staff_note', 'created_at', 'updated_at',
  ],
  visit_requests: [
    'id', 'organization_id', 'unit_id', 'visit_date', 'visit_time', 'full_name', 'phone', 'email', 'message',
    'status', 'appointment_id', 'staff_note', 'created_at', 'updated_at',
  ],
  calendar_feed: [
    'event_id', 'organization_id', 'source', 'kind', 'title', 'starts_at', 'ends_at', 'all_day', 'status',
    'appointment_id', 'lease_id', 'unit_id', 'branch_id', 'assigned_user_id', 'contact_ids', 'location', 'notify_by_email',
  ],
};

// What the public role reads. The views hold only the units that are on the website (0006: shown, not archived, priced,
// with a photo), and the site filters by organization itself, so there is deliberately no row filter here.
// Aggregations are allowed on public_listings only: the search pages need the total count of a filtered search
// (public_listings_aggregate).
const PUBLIC_SELECT_COLUMNS = {
  public_listings: [
    'id', 'organization_id', 'unit_id', 'kind', 'title', 'description', 'price', 'charges', 'deposit_months',
    'reservation_deposit', 'reservation_days', 'available_from', 'furnished', 'amenities', 'virtual_tour_url',
    'published_at', 'unit_type', 'rooms', 'surface_m2', 'floor', 'unit_status', 'city', 'governorate',
    'latitude', 'longitude', 'cover_file_id', 'photo_count',
    'bedrooms', 'bathrooms', 'parking_spaces', 'property_condition', 'pets_allowed', 'legal_status', 'orientation',
    'outdoor_area_m2', 'energy_class', 'min_lease_months', 'charges_included', 'year_built', 'floors_count',
    'neighbourhood_description', 'visit_fee', 'visit_payment_method',
  ],
  public_listing_photos: ['listing_id', 'storage_file_id', 'position', 'organization_id'],
  // Row type of the visitor submit functions (the view has no rows) and the visit slots already taken (no names).
  request_receipt: ['id', 'kind'],
  public_taken_visit_slots: ['unit_id', 'organization_id', 'visit_date', 'visit_time'],
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
    insert: ['branch_id', 'name', 'type', 'address_line', 'city', 'governorate', 'postal_code', 'latitude', 'longitude', ...PROPERTY_DETAIL_COLUMNS],
    update: ['branch_id', 'name', 'address_line', 'city', 'governorate', 'postal_code', 'latitude', 'longitude', ...PROPERTY_DETAIL_COLUMNS, 'archived_at'],
  },
  units: {
    roles: WRITERS,
    insert: [
      'property_id', 'code', 'type', 'floor', 'rooms', 'surface_m2', 'rent_amount', 'status', 'common_share',
      'title', 'description', 'sale_price', 'charges', 'available_from', 'furnished', 'amenities', 'show_on_website',
      ...UNIT_DETAIL_COLUMNS,
    ],
    update: [
      'code', 'type', 'floor', 'rooms', 'surface_m2', 'rent_amount', 'status', 'common_share',
      'title', 'description', 'sale_price', 'charges', 'available_from', 'furnished', 'amenities', 'show_on_website',
      ...UNIT_DETAIL_COLUMNS,
      'archived_at',
    ],
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
  // Visitor requests are created by the public submit functions only (no insert, no delete): staff move them along.
  rental_requests: { roles: WRITERS, insert: null, update: ['status', 'staff_note'] },
  visit_requests: { roles: WRITERS, insert: null, update: ['status', 'staff_note', 'appointment_id'] },
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
  { type: 'object', table: 'property_files', name: 'unit', to: 'units', map: { unit_id: 'id' } },
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
  // public_listings is a view (no foreign key), so its photos relationship is manual too.
  { type: 'array', table: 'public_listings', name: 'photos', to: 'public_listing_photos', map: { id: 'listing_id' } },
  { type: 'object', table: 'rental_requests', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'object', table: 'visit_requests', name: 'unit', to: 'units', map: { unit_id: 'id' } },
  { type: 'object', table: 'visit_requests', name: 'appointment', to: 'appointments', map: { appointment_id: 'id' } },
  { type: 'object', table: 'notifications', name: 'lease', to: 'leases', map: { lease_id: 'id' } },
  { type: 'object', table: 'notifications', name: 'appointment', to: 'appointments', map: { appointment_id: 'id' } },
];

const tracks = TRACK.map((name) => ({ type: 'pg_track_table', args: { source, table: table(name) } }));
const drops = [];
const creates = [];

// Retire the tables nothing uses anymore. Runs with the other drops, after the storage permissions that used to
// depend on them (those are dropped first, below), and is safe to repeat: "not tracked" is ignored.
const untracks = UNTRACK.map((name) => ({ type: 'pg_untrack_table', args: { source, table: table(name), cascade: true } }));

const permissionTypes = ['select', 'insert', 'update', 'delete'];

// Storage permissions use relationships (storage.files.property_links, property_files.unit, units.property), and Hasura refuses to drop a relationship a permission depends on: drop them first, or a re-run
// fails on "already exists". Includes the public role's select.
for (const role of [...ROLES, PUBLIC_ROLE]) {
  for (const t of permissionTypes) {
    drops.push({ type: `pg_drop_${t}_permission`, args: { source, table: storageFiles, role } });
  }
}
drops.push({ type: 'pg_drop_select_permission', args: { source, table: storageBuckets, role: PUBLIC_ROLE } });

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

for (const name of Object.keys(SELECT_COLUMNS)) {
  for (const role of ROLES) {
    for (const t of permissionTypes) {
      drops.push({ type: `pg_drop_${t}_permission`, args: { source, table: table(name), role } });
    }
  }
}

for (const name of Object.keys(PUBLIC_SELECT_COLUMNS)) {
  drops.push({ type: 'pg_drop_select_permission', args: { source, table: table(name), role: PUBLIC_ROLE } });
}

drops.push({ type: 'pg_drop_select_permission', args: { source, table: table('request_receipt'), role: 'user' } });

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

for (const [name, columns] of Object.entries(PUBLIC_SELECT_COLUMNS)) {
  creates.push({
    type: 'pg_create_select_permission',
    args: {
      source, table: table(name), role: PUBLIC_ROLE,
      permission: { columns, filter: {}, ...(name === 'public_listings' ? { allow_aggregations: true } : {}) },
    },
  });
}

// The submit functions answer with rows of request_receipt: the client role reads that (empty) view.
creates.push({
  type: 'pg_create_select_permission',
  args: { source, table: table('request_receipt'), role: 'user', permission: { columns: PUBLIC_SELECT_COLUMNS.request_receipt, filter: {} } },
});

// A signed-in client reads the public catalogue too (/compte/visites shows which listing a request is about).
drops.push({ type: 'pg_drop_select_permission', args: { source, table: table('public_listings'), role: 'user' } });
creates.push({
  type: 'pg_create_select_permission',
  args: {
    source, table: table('public_listings'), role: 'user',
    permission: { columns: PUBLIC_SELECT_COLUMNS.public_listings, filter: {}, allow_aggregations: true },
  },
});

// A signed-in client reads only their own visit requests (/compte/visites).
drops.push({ type: 'pg_drop_select_permission', args: { source, table: table('visit_requests'), role: 'user' } });
creates.push({
  type: 'pg_create_select_permission',
  args: {
    source, table: table('visit_requests'), role: 'user',
    permission: {
      columns: ['id', 'unit_id', 'visit_date', 'visit_time', 'status', 'created_at'],
      filter: { client_user_id: { _eq: USER_VAR } },
    },
  },
});

for (const [name, w] of Object.entries(WRITE_COLUMNS)) {
  for (const role of w.roles) {
    if (w.insert) {
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
    }
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
    permission: { columns: ['name', 'visit_payment_method'], filter: orgFilter('id'), check: orgFilter('id') },
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

// The storage permission drops are above, before the relationship drops. Only the relationships on storage.files
// itself are dropped here.
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
// The public site shows the photos of units that are on the website: only files of the property-files bucket that are
// a photo of a unit (never of a bien) which passes the same rules as the public views (migration 0006): shown on the
// website, unit and bien not archived, vacant with a rent or for sale with a sale price. The "at least one photo" rule
// holds by itself, since the file being read is one. Only four harmless columns; the public role cannot list other
// buckets or lease documents.
const onWebsiteUnit = {
  show_on_website: { _eq: true },
  archived_at: { _is_null: true },
  property: { archived_at: { _is_null: true } },
  _or: [
    { _and: [{ status: { _eq: 'vacant' } }, { rent_amount: { _gt: 0 } }] },
    { _and: [{ status: { _eq: 'for_sale' } }, { sale_price: { _gt: 0 } }] },
  ],
};
const publishedListingPhoto = {
  _and: [
    { bucket_id: { _eq: 'property-files' } },
    { property_links: { kind: { _eq: 'photo' }, unit: onWebsiteUnit } },
  ],
};
creates.push({
  type: 'pg_create_select_permission',
  args: {
    source, table: storageFiles, role: PUBLIC_ROLE,
    // Nhost's storage service answers a request by reading the file's record (and its bucket) with the caller's role:
    // a column it cannot read makes it answer "you are not authorized" (HTTP 403), even for a file the role may see.
    // So the public role reads the whole record of a published photo, minus who uploaded it.
    permission: { columns: PUBLIC_FILE_COLUMNS, filter: publishedListingPhoto },
  },
});
// ... and the settings of the bucket those photos live in (cache control, presigned urls on/off, size limits).
creates.push({
  type: 'pg_create_select_permission',
  args: {
    source, table: storageBuckets, role: PUBLIC_ROLE,
    permission: { columns: PUBLIC_BUCKET_COLUMNS, filter: { id: { _eq: 'property-files' } } },
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

// The visitor forms of the public site: mutations the unauthenticated role may call (they validate everything and
// answer with the id of the new request; see migration 0008).
// Since migration 0009 they need a signed-in client (Nhost default role 'user'); the public role no longer may call them.
const CLIENT_ROLE = 'user';
const PUBLIC_FUNCTIONS = ['submit_rental_request', 'submit_visit_request'];
for (const name of PUBLIC_FUNCTIONS) {
  drops.push({ type: 'pg_drop_function_permission', args: { source, function: fn(name), role: PUBLIC_ROLE } });
  drops.push({ type: 'pg_drop_function_permission', args: { source, function: fn(name), role: CLIENT_ROLE } });
  drops.push({ type: 'pg_untrack_function', args: { source, function: fn(name) } });
  creates.push({ type: 'pg_track_function', args: { source, function: fn(name), configuration: { exposed_as: 'mutation' } } });
  creates.push({ type: 'pg_create_function_permission', args: { source, function: fn(name), role: CLIENT_ROLE } });
}

// Every tracked table needs select columns, or nobody could read it.
for (const name of TRACK) {
  if (!SELECT_COLUMNS[name] && !PUBLIC_SELECT_COLUMNS[name]) {
    throw new Error(`TRACK has ${name} but neither SELECT_COLUMNS nor PUBLIC_SELECT_COLUMNS does.`);
  }
}

if (DRY_RUN) {
  const permissions = creates.filter((entry) => entry.type.endsWith('_permission')).length;
  console.log(
    `Dry run: ${TRACK.length} tracked tables/views, ${RELATIONSHIPS.length + 2} relationships, ` +
      `${permissions} permissions, ${WRITER_FUNCTIONS.length + ADMIN_FUNCTIONS.length} functions. Nothing sent.`,
  );
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const RETRY_WAITS_MS = [2000, 4000, 8000, 15000, 30000, 45000];

// One metadata call. A 5xx (the gateway in front of Hasura giving up while Hasura is busy or restarting) is retried with a
// growing pause; every operation here is safe to repeat. The raw reply is kept because the gateway's error body is not JSON.
async function metadata(body) {
  let last = { ok: false, status: 0, json: {}, raw: '', note: '' };
  for (let attempt = 0; attempt <= RETRY_WAITS_MS.length; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(`${HASURA_URL}/v1/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': SECRET },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let json = {};
      try {
        json = JSON.parse(raw);
      } catch {
        // Not JSON (a gateway error page): the raw text is reported instead.
      }
      const note = `${Date.now() - started} ms, server=${res.headers.get('server') ?? '?'}, content-type=${res.headers.get('content-type') ?? '?'}`;
      last = { ok: res.ok, status: res.status, json, raw, note };
      if (res.status < 500) return last;
    } catch (error) {
      last = { ok: false, status: 0, json: {}, raw: '', note: `network error: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (attempt === RETRY_WAITS_MS.length) break;
    const wait = RETRY_WAITS_MS[attempt];
    console.warn(`  ${last.status || 'no reply'} (${last.note}); retrying in ${wait / 1000}s (${attempt + 1}/${RETRY_WAITS_MS.length})`);
    await sleep(wait);
  }
  return last;
}

const describeOp = (op) => `${op.type} ${op.args?.table?.name ?? op.args?.function?.name ?? ''} ${op.args?.role ?? ''}`.trim();

function fail(stage, result, args) {
  console.error(`${stage} failed: HTTP ${result.status} (${result.note})`);
  console.error(result.raw ? result.raw.slice(0, 600) : '(empty body)');
  if (args) {
    console.error('This batch:');
    for (const op of args) console.error('  -', describeOp(op));
  }
  process.exit(1);
}

// What differs. Every metadata change makes Hasura rebuild its whole schema, and a small instance gets killed after a few
// hundred rebuilds in a row (the gateway then answers 502/503). So the current metadata is read first and only the entries
// that are missing or different are sent. --full drops and recreates everything instead.
const tableKey = (t) => `${t.schema}.${t.name}`;
const canon = (value) => {
  if (Array.isArray(value)) return value.map(canon);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canon(value[key])]));
  return value;
};
const permissionSignature = (permission = {}) => {
  const out = {};
  if (Array.isArray(permission.columns)) out.columns = [...permission.columns].sort();
  else if (permission.columns) out.columns = permission.columns;
  if (permission.filter !== undefined && permission.filter !== null) out.filter = canon(permission.filter);
  if (permission.check !== undefined && permission.check !== null) out.check = canon(permission.check);
  if (permission.set && Object.keys(permission.set).length > 0) out.set = canon(permission.set);
  if (permission.allow_aggregations) out.allow_aggregations = true;
  if (permission.backend_only) out.backend_only = true;
  return JSON.stringify(out);
};

function infoOf(op, state) {
  const a = op.args;
  let match = /^pg_(create|drop)_(select|insert|update|delete)_permission$/.exec(op.type);
  if (match) {
    const found = (state.tables.get(tableKey(a.table))?.[`${match[2]}_permissions`] ?? []).find((entry) => entry.role === a.role);
    return {
      kind: 'perm',
      key: `perm|${match[2]}|${tableKey(a.table)}|${a.role}`,
      exists: Boolean(found),
      same: Boolean(found) && match[1] === 'create' && permissionSignature(found.permission) === permissionSignature(a.permission),
    };
  }
  match = /^pg_create_(object|array)_relationship$/.exec(op.type);
  if (match || op.type === 'pg_drop_relationship') {
    const name = a.name ?? a.relationship;
    const entry = state.tables.get(tableKey(a.table));
    const found = [...(entry?.object_relationships ?? []), ...(entry?.array_relationships ?? [])].some((relationship) => relationship.name === name);
    return { kind: 'rel', key: `rel|${tableKey(a.table)}|${name}`, exists: found, same: found && Boolean(match) };
  }
  if (op.type === 'pg_track_function' || op.type === 'pg_untrack_function') {
    const found = state.functions.get(tableKey(a.function));
    const wanted = a.configuration?.exposed_as ?? '';
    return {
      kind: 'fn',
      key: `fn|${tableKey(a.function)}`,
      fk: tableKey(a.function),
      exists: Boolean(found),
      same: Boolean(found) && op.type === 'pg_track_function' && (wanted === '' || wanted === (found.configuration?.exposed_as ?? '')),
    };
  }
  if (op.type === 'pg_create_function_permission' || op.type === 'pg_drop_function_permission') {
    const found = state.functions.get(tableKey(a.function))?.permissions?.some((entry) => entry.role === a.role) ?? false;
    return {
      kind: 'fnperm',
      key: `fnperm|${tableKey(a.function)}|${a.role}`,
      fk: tableKey(a.function),
      exists: found,
      same: found && op.type === 'pg_create_function_permission',
    };
  }
  return { kind: 'other', key: `other|${op.type}|${JSON.stringify(a)}`, exists: false, same: false };
}

function planDelta(current) {
  const state = {
    tables: new Map((current.tables ?? []).map((entry) => [tableKey(entry.table), entry])),
    functions: new Map((current.functions ?? []).map((entry) => [tableKey(entry.function), entry])),
  };
  const infos = new Map([...drops, ...creates].map((op) => [op, infoOf(op, state)]));
  const wantedKeys = new Set(creates.map((op) => infos.get(op).key));
  const changed = new Set(creates.filter((op) => !infos.get(op).same).map((op) => infos.get(op).key));
  // Untracking a function removes its permissions, so a function that is redone gets its permissions redone too.
  const redone = new Set(creates.filter((op) => op.type === 'pg_track_function' && changed.has(infos.get(op).key)).map((op) => infos.get(op).fk));
  for (const op of creates) {
    const info = infos.get(op);
    if (info.kind === 'fnperm' && redone.has(info.fk)) changed.add(info.key);
  }
  return {
    state,
    drops: drops.filter((op) => {
      const info = infos.get(op);
      return info.exists && (changed.has(info.key) || !wantedKeys.has(info.key));
    }),
    creates: creates.filter((op) => changed.has(infos.get(op).key)),
  };
}

// Step -1: does Hasura answer the metadata API at all, and is its metadata consistent?
const health = await metadata({ type: 'get_inconsistent_metadata', args: {} });
if (!health.ok) fail('Hasura health check', health);
if (health.json.is_consistent === false) {
  const objects = health.json.inconsistent_objects ?? [];
  console.warn(`Hasura reports ${objects.length} inconsistent metadata objects (first 15):`);
  for (const object of objects.slice(0, 15)) console.warn('  -', object.type, String(object.reason ?? '').slice(0, 200));
}

// Step -0.5: read the current metadata and keep only what differs.
let plan = { drops, creates };
let tracksTodo = tracks;
let untracksTodo = untracks;
if (!process.argv.includes('--full')) {
  const exported = await metadata({ type: 'export_metadata', args: {} });
  if (!exported.ok) fail('Reading the current metadata', exported);
  const current = (exported.json.metadata ?? exported.json).sources?.find((entry) => entry.name === source) ?? {};
  plan = planDelta(current);
  tracksTodo = tracks.filter((op) => !plan.state.tables.has(tableKey(op.args.table)));
  untracksTodo = untracks.filter((op) => plan.state.tables.has(tableKey(op.args.table)));
  console.log(
    `Already up to date: ${creates.length - plan.creates.length} of ${creates.length} entries. ` +
      `To send: ${tracksTodo.length} tracks, ${plan.drops.length} drops, ${untracksTodo.length} untracks, ${plan.creates.length} creates.`,
  );
}

// Each metadata change makes Hasura rebuild its schema, so one request with many operations outlives the
// gateway timeout on a small instance. Send small batches instead; every batch is safe to repeat.
const BATCH = 5;
const batches = (args) => Array.from({ length: Math.ceil(args.length / BATCH) }, (_, i) => args.slice(i * BATCH, (i + 1) * BATCH));

// Step 0: track new tables and views. "already tracked" is fine on later runs; any other
// error (usually: the table does not exist because migration 0002 was not applied) stops here.
if (tracksTodo.length > 0) {
  const tracked = await metadata({ type: 'bulk_keep_going', args: tracksTodo });
  if (!tracked.ok && tracked.status >= 500) fail('Tracking', tracked);
  const trackResults = Array.isArray(tracked.json) ? tracked.json : [tracked.json];
  const trackErrors = trackResults
    .map((result, index) => ({ op: tracksTodo[index], result }))
    .filter(({ result }) => result?.error && result.code !== 'already-tracked');
  if (!tracked.ok || trackErrors.length > 0) {
    console.error('Tracking failed. Is db/migrations/0002_core_records.sql applied on this project?');
    for (const { op, result } of trackErrors) console.error(`  ${op?.args?.table?.name}: ${result.error}`);
    if (!tracked.ok) console.error(JSON.stringify(tracked.json, null, 2));
    process.exit(1);
  }
}

// Step 1: drop previous versions (errors for "does not exist" are expected; a server failure is not).
let dropped = 0;
for (const args of batches(plan.drops)) {
  const result = await metadata({ type: 'bulk_keep_going', args });
  if (!result.ok) fail(`Dropping old entries (after ${dropped} of ${plan.drops.length})`, result, args);
  dropped += args.length;
  if (dropped % 50 === 0 || dropped === plan.drops.length) console.log(`  drop ${dropped}/${plan.drops.length}`);
  await sleep(200);
}

// Step 1b: untrack the retired tables. Not being tracked (any run after the first) is fine; anything else is reported.
if (untracksTodo.length > 0) {
  const untracked = await metadata({ type: 'bulk_keep_going', args: untracksTodo });
  if (!untracked.ok && untracked.status >= 500) fail('Untracking retired tables', untracked);
  (Array.isArray(untracked.json) ? untracked.json : [untracked.json]).forEach((result, index) => {
    if (result?.error && !['not-exists', 'already-untracked'].includes(result.code)) {
      console.warn(`Could not untrack ${untracksTodo[index]?.args?.table?.name}: ${result.error}`);
    }
  });
}

// Step 2: create everything that is missing, batch by batch. An entry that already exists is fine (a batch that was retried
// after a gateway timeout may have been applied the first time); any other error stops the run.
const ACCEPTED = new Set(['already-exists', 'already-tracked']);
let sent = 0;
for (const args of batches(plan.creates)) {
  const result = await metadata({ type: 'bulk_keep_going', args });
  if (!result.ok) fail(`Creating (after ${sent} of ${plan.creates.length})`, result, args);
  const results = Array.isArray(result.json) ? result.json : [];
  const errors = results.map((entry, index) => ({ op: args[index], entry })).filter(({ entry }) => entry?.error && !ACCEPTED.has(entry.code));
  if (errors.length > 0) {
    console.error(`Creating failed after ${sent} of ${plan.creates.length} operations:`);
    for (const { op, entry } of errors) console.error('  -', describeOp(op), '->', entry.code, entry.error);
    process.exit(1);
  }
  sent += args.length;
  console.log(`  ${sent}/${plan.creates.length}`);
  await sleep(250);
}
console.log(`Done: ${plan.creates.length} entries created or updated, ${creates.length - plan.creates.length} already up to date.`);
