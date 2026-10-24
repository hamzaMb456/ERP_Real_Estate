// Pure part of the Postgres -> DynamoDB migration: reshape rows into items (+ the lock/counter
// items the domain code relies on), and check the result. No I/O here, so it is unit-tested.
import { currentOwners, firstDayOverCap } from '../lambda/domain/ownership-rules.ts';
import { overlappingLeaseNumber } from '../lambda/domain/lease-rules.ts';

export const SOURCE_TABLES = [
  'organizations', 'branches', 'properties', 'units', 'contacts', 'contact_roles', 'ownerships', 'property_files', 'lease_files',
  'common_areas', 'leases', 'lease_units', 'lease_parties', 'lease_rents', 'lease_terms', 'appointments', 'appointment_participants',
  'notifications', 'rental_requests', 'visit_requests', 'app_storage_files', 'staff_members',
];

const RETENTION_DAYS = 90;
const DAY_SECONDS = 86_400;

const groupBy = (rows, key) => {
  const map = new Map();
  for (const r of rows) map.set(r[key], [...(map.get(r[key]) ?? []), r]);
  return map;
};
const typed = (model, rows) => rows.map((r) => ({ __typename: model, ...r }));
const lock = (id, extra = {}) => ({ __typename: 'Lock', id, value: 1, ...extra });

/** Rows (by source table) -> items (by model) + lock items. `today` is the Tunis day of the run. */
export function transform(src, today, now = new Date()) {
  const units = src.units ?? [];
  const contacts = src.contacts ?? [];
  const ownershipsByUnit = groupBy(src.ownerships ?? [], 'unit_id');
  const rolesByContact = groupBy(src.contact_roles ?? [], 'contact_id');
  const unitById = new Map(units.map((u) => [u.id, u]));
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const leaseUnits = groupBy(src.lease_units ?? [], 'lease_id');
  const leaseParties = groupBy(src.lease_parties ?? [], 'lease_id');
  const rents = groupBy(src.lease_rents ?? [], 'lease_id');
  const terms = groupBy(src.lease_terms ?? [], 'lease_id');
  const cutoff = now.getTime() - RETENTION_DAYS * DAY_SECONDS * 1000;

  const leases = (src.leases ?? []).map((l) => {
    const unitIds = (leaseUnits.get(l.id) ?? []).map((lu) => lu.unit_id);
    return {
      ...l,
      rents: (rents.get(l.id) ?? []).map(({ id, unit_id, effective_from, rent_amount, charges_amount, reason, created_at }) => ({ id, unit_id, effective_from, rent_amount, charges_amount, reason, created_at })),
      terms: (terms.get(l.id) ?? []).map(({ id, kind, start_date, end_date, recorded_on, note, created_at }) => ({ id, kind, start_date, end_date, recorded_on, note, created_at })),
      unit_ids: unitIds,
      unit_labels: unitIds.map((id) => unitById.get(id)?.code ?? ''),
      party_names: (leaseParties.get(l.id) ?? []).filter((p) => p.role === 'renter').map((p) => contactById.get(p.contact_id)?.full_name ?? '').sort((a, b) => a.localeCompare(b)),
    };
  });

  const fileLinks = [
    ...(src.property_files ?? []).map((f) => ({
      id: f.id, organization_id: f.organization_id, target_key: f.property_id ? `property#${f.property_id}` : `unit#${f.unit_id}`,
      property_id: f.property_id, unit_id: f.unit_id, lease_id: null, storage_file_id: f.storage_file_id, kind: f.kind, category: f.category,
      title: f.title, is_cover: f.is_cover, sort_order: f.sort_order ?? 0, created_at: f.created_at, updated_at: f.updated_at,
    })),
    ...(src.lease_files ?? []).map((f) => ({
      id: f.id, organization_id: f.organization_id, target_key: `lease#${f.lease_id}`, property_id: null, unit_id: null, lease_id: f.lease_id,
      storage_file_id: f.storage_file_id, kind: 'document', category: f.category, title: f.title, is_cover: false, sort_order: 0,
      created_at: f.created_at, updated_at: f.updated_at,
    })),
  ];

  // byClient is a GSI on client_user_id: an explicit null is rejected, so it is omitted instead.
  const withoutNullClient = ({ client_user_id, ...rest }) => (client_user_id ? { client_user_id, ...rest } : rest);

  const items = {
    Organization: typed('Organization', src.organizations ?? []),
    Branch: typed('Branch', src.branches ?? []),
    Property: typed('Property', src.properties ?? []),
    Unit: typed('Unit', units.map((u) => ({ ...u, current_owners: currentOwners(ownershipsByUnit.get(u.id) ?? [], today) }))),
    Contact: typed('Contact', contacts.map((c) => ({ ...c, roles: (rolesByContact.get(c.id) ?? []).map((r) => r.role) }))),
    Ownership: typed('Ownership', src.ownerships ?? []),
    FileLink: typed('FileLink', fileLinks),
    CommonArea: typed('CommonArea', src.common_areas ?? []),
    Lease: typed('Lease', leases),
    LeaseUnit: typed('LeaseUnit', (src.lease_units ?? []).map((lu) => ({ ...lu, updated_at: lu.created_at }))),
    LeaseParty: typed('LeaseParty', (src.lease_parties ?? []).map((lp) => ({ ...lp, updated_at: lp.created_at }))),
    Appointment: typed('Appointment', src.appointments ?? []),
    AppointmentParticipant: typed('AppointmentParticipant', src.appointment_participants ?? []),
    Notification: typed('Notification', (src.notifications ?? []).filter((n) => Date.parse(n.created_at) >= cutoff).map((n) => ({
      ...n, id: `${n.user_id}#${n.dedupe_key}`, updated_at: n.created_at,
      expires_at: Math.floor(Date.parse(n.created_at) / 1000) + RETENTION_DAYS * DAY_SECONDS,
    }))),
    RentalRequest: typed('RentalRequest', (src.rental_requests ?? []).map(withoutNullClient)),
    VisitRequest: typed('VisitRequest', (src.visit_requests ?? []).map(withoutNullClient)),
    StorageFile: typed('StorageFile', (src.app_storage_files ?? []).map((f) => ({ ...f, updated_at: f.created_at }))),
    // display_name is the byOrg sort key: never missing (fall back to the email, as the view did).
    StaffMember: typed('StaffMember', (src.staff_members ?? []).map((s) => ({
      id: s.user_id, organization_id: s.organization_id, display_name: s.display_name || s.email || s.user_id, email: s.email, role: s.role,
    }))),
  };

  const locks = [];
  for (const [orgId, orgLeases] of groupBy(leases, 'organization_id')) {
    locks.push(lock(`COUNTER#lease#${orgId}`, { value: Math.max(...orgLeases.map((l) => l.number)) }));
  }
  const occupants = new Map();
  for (const l of leases.filter((x) => x.status !== 'draft')) for (const u of l.unit_ids) occupants.set(u, [...(occupants.get(u) ?? []), l.id]);
  for (const [unitId, ids] of occupants) locks.push(lock(`UNITLEASE#${unitId}`, { lease_ids: ids }));
  for (const [unitId, rows] of ownershipsByUnit) locks.push(lock(`UNITOWN#${unitId}`, { ownership_ids: rows.map((r) => r.id) }));
  for (const u of units.filter((x) => !x.archived_at)) locks.push(lock(`UNIQ#unitcode#${u.property_id}#${u.code}`, { unit_id: u.id }));
  for (const f of fileLinks) {
    locks.push(lock(`UNIQ#file#${f.storage_file_id}`, { file_id: f.id }));
    if (f.is_cover) locks.push(lock(`COVER#${f.target_key}`, { file_id: f.id }));
  }
  for (const v of (src.visit_requests ?? []).filter((x) => x.status === 'confirmed')) locks.push(lock(`SLOT#${v.unit_id}#${v.visit_date}#${v.visit_time}`));
  return { items, locks };
}

/** References, invariants and money totals of the transformed data. Returns the list of problems. */
export function check(src, { items }) {
  const problems = [];
  const ids = (model) => new Set(items[model].map((x) => x.id));
  const [properties, units, branches, contacts, leasesIds] = [ids('Property'), ids('Unit'), ids('Branch'), ids('Contact'), ids('Lease')];
  const missing = (what, ok) => { if (!ok) problems.push(what); };

  for (const p of items.Property) missing(`property ${p.id}: branch ${p.branch_id} missing`, branches.has(p.branch_id));
  for (const u of items.Unit) missing(`unit ${u.id}: property ${u.property_id} missing`, properties.has(u.property_id));
  for (const o of items.Ownership) missing(`ownership ${o.id}: unit/contact missing`, units.has(o.unit_id) && contacts.has(o.contact_id));
  for (const l of items.Lease) for (const u of l.unit_ids) missing(`lease ${l.number}: unit ${u} missing`, units.has(u));
  for (const p of items.LeaseParty) missing(`lease party ${p.lease_id}/${p.contact_id} missing ref`, leasesIds.has(p.lease_id) && contacts.has(p.contact_id));
  for (const f of items.FileLink) {
    const ok = f.property_id ? properties.has(f.property_id) : f.unit_id ? units.has(f.unit_id) : leasesIds.has(f.lease_id);
    missing(`file ${f.id}: target missing`, ok);
  }

  for (const [unitId, rows] of groupBy(items.Ownership, 'unit_id')) {
    const day = firstDayOverCap(rows);
    if (day) problems.push(`unit ${unitId}: ownership shares over 100% on ${day}`);
  }
  const occupying = items.Lease.filter((l) => l.status !== 'draft');
  for (const l of occupying) {
    const others = occupying.filter((o) => o.id !== l.id && o.unit_ids.some((u) => l.unit_ids.includes(u)));
    const n = overlappingLeaseNumber(others, l.id, l.start_date, l.ended_on ?? l.end_date);
    if (n !== null) problems.push(`lease ${l.number}: overlaps lease ${n}`);
  }
  const sum = (rows) => Math.round(rows.reduce((s, r) => s + Number(r.rent_amount), 0) * 1000);
  missing('rent totals differ', sum(src.lease_rents ?? []) === sum(items.Lease.flatMap((l) => l.rents)));
  return problems;
}
