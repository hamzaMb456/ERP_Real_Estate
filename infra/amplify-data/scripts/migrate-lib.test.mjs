import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, transform } from './migrate-lib.mjs';

const src = {
  organizations: [{ id: 'O', name: 'Agence' }],
  branches: [{ id: 'B', organization_id: 'O', name: 'Siège' }],
  properties: [{ id: 'P', organization_id: 'O', branch_id: 'B', name: 'Résidence', type: 'building' }],
  units: [{ id: 'U', organization_id: 'O', property_id: 'P', code: 'A1', status: 'rented', archived_at: null }],
  contacts: [{ id: 'C', organization_id: 'O', full_name: 'Ali' }, { id: 'D', organization_id: 'O', full_name: 'Zied' }],
  contact_roles: [{ contact_id: 'C', role: 'owner' }, { contact_id: 'D', role: 'renter' }],
  ownerships: [{ id: 'W', organization_id: 'O', unit_id: 'U', contact_id: 'C', share_percent: 100, starts_on: '2020-01-01', ends_on: null }],
  property_files: [{ id: 'F', organization_id: 'O', unit_id: 'U', property_id: null, storage_file_id: 'S', kind: 'photo', category: null, title: 't', is_cover: true, sort_order: 1 }],
  leases: [{ id: 'L', organization_id: 'O', number: 3, status: 'active', start_date: '2026-01-01', end_date: '2026-12-31', ended_on: null }],
  lease_units: [{ organization_id: 'O', lease_id: 'L', unit_id: 'U', created_at: 'x' }],
  lease_parties: [{ organization_id: 'O', lease_id: 'L', contact_id: 'D', role: 'renter', created_at: 'x' }],
  lease_rents: [{ id: 'R', lease_id: 'L', unit_id: 'U', effective_from: '2026-01-01', rent_amount: 900.5, charges_amount: 0 }],
  notifications: [
    { id: 'N1', user_id: 'X', dedupe_key: 'k1', created_at: new Date().toISOString() },
    { id: 'N2', user_id: 'X', dedupe_key: 'k2', created_at: '2020-01-01T00:00:00Z' },
  ],
  visit_requests: [{ id: 'V', organization_id: 'O', unit_id: 'U', client_user_id: null, visit_date: '2026-05-05', visit_time: '10:00:00', status: 'confirmed' }],
  staff_members: [{ user_id: 'X', organization_id: 'O', display_name: '', email: 'x@a.tn', role: 'manager' }],
};

test('reshapes rows into items with embedded rents, roles, owners and labels', () => {
  const { items } = transform(src, '2026-10-24');
  const lease = items.Lease[0];
  assert.deepEqual([lease.unit_ids, lease.unit_labels, lease.party_names, lease.rents[0].rent_amount], [['U'], ['A1'], ['Zied'], 900.5]);
  assert.deepEqual(items.Contact.map((c) => c.roles), [['owner'], ['renter']]);
  assert.deepEqual(items.Unit[0].current_owners, [{ contact_id: 'C', share_percent: 100 }]);
  assert.equal(items.FileLink[0].target_key, 'unit#U');
  assert.equal(items.Notification.length, 1);
  assert.equal(items.Notification[0].id, 'X#k1');
  assert.equal('client_user_id' in items.VisitRequest[0], false);
  assert.equal(items.StaffMember[0].display_name, 'x@a.tn');
});

test('builds the lock and counter items the domain code relies on', () => {
  const { locks } = transform(src, '2026-10-24');
  const byId = new Map(locks.map((l) => [l.id, l]));
  assert.equal(byId.get('COUNTER#lease#O').value, 3);
  assert.deepEqual(byId.get('UNITLEASE#U').lease_ids, ['L']);
  assert.deepEqual(byId.get('UNITOWN#U').ownership_ids, ['W']);
  assert.equal(byId.get('UNIQ#unitcode#P#A1').unit_id, 'U');
  assert.equal(byId.get('UNIQ#file#S').file_id, 'F');
  assert.equal(byId.get('COVER#unit#U').file_id, 'F');
  assert.ok(byId.has('SLOT#U#2026-05-05#10:00:00'));
});

test('check: clean data passes; broken references, share cap and overlaps are reported', () => {
  assert.deepEqual(check(src, transform(src, '2026-10-24')), []);
  const broken = {
    ...src,
    ownerships: [...src.ownerships, { id: 'W2', organization_id: 'O', unit_id: 'U', contact_id: 'D', share_percent: 10, starts_on: '2021-01-01', ends_on: null }],
    leases: [...src.leases, { id: 'L2', organization_id: 'O', number: 4, status: 'active', start_date: '2026-06-01', end_date: '2027-05-31', ended_on: null }],
    lease_units: [...src.lease_units, { organization_id: 'O', lease_id: 'L2', unit_id: 'U', created_at: 'x' }, { organization_id: 'O', lease_id: 'L2', unit_id: 'GONE', created_at: 'x' }],
  };
  const problems = check(broken, transform(broken, '2026-10-24'));
  assert.ok(problems.some((p) => p.includes('over 100%')));
  assert.ok(problems.some((p) => p.includes('overlaps lease')));
  assert.ok(problems.some((p) => p.includes('unit GONE missing')));
});
