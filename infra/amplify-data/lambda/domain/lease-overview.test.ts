import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Lease, LeaseRent } from './lease-rules.ts';
import { currentRents, leaseFlags, leaseOverview } from './lease-overview.ts';

const lease = (over: Partial<Lease>): Lease => ({
  id: 'L', organization_id: 'O', number: 1, status: 'active', start_date: '2026-01-01', end_date: '2026-12-31',
  payment_day: 1, deposit_amount: 0, rents: [], terms: [], created_at: '', updated_at: '', ...over,
});
const rent = (unit: string, from: string, amount: number): LeaseRent => ({
  id: `${unit}${from}`, unit_id: unit, effective_from: from, rent_amount: amount, charges_amount: 10, created_at: '',
});

test('ending soon within 60 days, grace week after the end, days left', () => {
  assert.equal(leaseFlags(lease({}), '2026-11-01').is_ending_soon, true);
  assert.equal(leaseFlags(lease({}), '2026-10-31').is_ending_soon, false);
  const grace = leaseFlags(lease({}), '2027-01-03');
  assert.deepEqual([grace.in_grace, grace.grace_days_left], [true, 4]);
  assert.equal(leaseFlags(lease({}), '2027-01-08').in_grace, false);
  assert.equal(leaseFlags(lease({ status: 'ended' }), '2026-11-01').is_ending_soon, false);
});

test('registration: pending, due soon 10 days before the 60-day deadline, overdue, registered', () => {
  const signed = lease({ signed_at: '2026-01-01' });
  assert.equal(leaseFlags(signed, '2026-01-20').registration_state, 'pending');
  assert.equal(leaseFlags(signed, '2026-02-20').registration_state, 'due_soon');
  assert.equal(leaseFlags(signed, '2026-03-03').registration_state, 'overdue');
  assert.equal(leaseFlags({ ...signed, registered_at: '2026-01-10' }, '2026-03-03').registration_state, 'registered');
  assert.equal(leaseFlags({ ...signed, status: 'ended' }, '2026-03-03').registration_state, 'not_applicable');
  assert.equal(leaseFlags(lease({ status: 'draft' }), '2026-03-03').registration_state, 'not_applicable');
});

test('current rent: latest started row, else earliest; next change after today', () => {
  const rows = [rent('U', '2026-01-01', 900), rent('U', '2026-07-01', 950), rent('U', '2027-01-01', 1000)];
  assert.deepEqual(currentRents(rows, '2026-08-01').map((r) => [r.rent_amount, r.next_change_on]), [[950, '2027-01-01']]);
  assert.deepEqual(currentRents(rows, '2025-12-01').map((r) => [r.rent_amount, r.next_change_on]), [[900, '2026-07-01']]);
});

test('overview: totals over units, sorted codes, renter names', () => {
  const row = leaseOverview(lease({
    rents: [rent('U1', '2026-01-01', 900.5), rent('U2', '2026-01-01', 100.25)], unit_labels: ['B2', 'A1'], party_names: ['Ali', 'Sana'],
  }), '2026-02-01');
  assert.deepEqual([row.total_rent, row.total_charges, row.unit_codes, row.renter_names, row.unit_count], [1000.75, 20, 'A1, B2', 'Ali, Sana', 2]);
});
