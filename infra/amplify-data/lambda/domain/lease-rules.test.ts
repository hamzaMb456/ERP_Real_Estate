import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, isIsoDate, rangesOverlap, todayTunis } from './dates.ts';
import type { DraftInput, Lease } from './lease-rules.ts';
import {
  assertActivatable,
  assertEndable,
  assertRenewable,
  overlappingLeaseNumber,
  unitTarget,
  validateDraft,
} from './lease-rules.ts';

const lease = (over: Partial<Lease>): Lease => ({
  id: 'L1', organization_id: 'O', number: 1, status: 'active', start_date: '2026-01-01', end_date: '2026-12-31',
  payment_day: 1, deposit_amount: 0, rents: [], terms: [], created_at: '', updated_at: '', ...over,
});
const draft = (over: Partial<DraftInput> = {}): DraftInput => ({
  start_date: '2026-01-01', end_date: '2026-12-31', unit_ids: ['U1'],
  parties: [{ contact_id: 'C1', role: 'renter' }],
  rents: [{ unit_id: 'U1', effective_from: '2026-01-01', rent_amount: 900 }], ...over,
});
const code = (fn: () => unknown): string => {
  try { fn(); } catch (err) { return (err as { code: string }).code; }
  return 'no error';
};

test('dates: Tunis day, day math, iso check, inclusive overlap', () => {
  assert.equal(todayTunis(new Date('2026-03-01T23:30:00Z')), '2026-03-02');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-01-08', -7), '2026-01-01');
  assert.equal(isIsoDate('2026-13-01'), false);
  assert.equal(rangesOverlap('2026-01-01', '2026-01-31', '2026-01-31', '2026-02-10'), true);
  assert.equal(rangesOverlap('2026-01-01', '2026-01-30', '2026-01-31', '2026-02-10'), false);
});

test('overlap: lowest number of a non-draft lease, using the real end date', () => {
  const others = [
    lease({ id: 'A', number: 7, start_date: '2026-06-01', end_date: '2027-05-31' }),
    lease({ id: 'B', number: 3, status: 'ended', start_date: '2025-01-01', end_date: '2026-12-31', ended_on: '2026-02-15' }),
    lease({ id: 'C', number: 1, status: 'draft' }),
  ];
  assert.equal(overlappingLeaseNumber(others, 'X', '2026-02-01', '2026-03-01'), 3);
  assert.equal(overlappingLeaseNumber(others, 'X', '2026-02-16', '2026-05-31'), null);
  assert.equal(overlappingLeaseNumber(others, 'A', '2026-07-01', '2026-08-01'), null);
});

test('draft validation mirrors the table constraints', () => {
  assert.equal(code(() => validateDraft(draft())), 'no error');
  assert.equal(code(() => validateDraft(draft({ end_date: '2026-01-01' }))), 'leases_dates_check');
  assert.equal(code(() => validateDraft(draft({ payment_day: 29 }))), 'leases_payment_day_check');
  assert.equal(code(() => validateDraft(draft({ deposit_amount: -1 }))), 'leases_deposit_amount_check');
  assert.equal(code(() => validateDraft(draft({ rents: [{ unit_id: 'U1', effective_from: '2025-12-31', rent_amount: 1 }] }))), 'lease_rent_before_start');
  assert.equal(code(() => validateDraft(draft({ rents: [{ unit_id: 'U9', effective_from: '2026-01-01', rent_amount: 1 }] }))), 'lease_unit_not_found');
  assert.equal(code(() => validateDraft(draft({
    rents: [{ unit_id: 'U1', effective_from: '2026-01-01', rent_amount: 1 }, { unit_id: 'U1', effective_from: '2026-01-01', rent_amount: 2 }],
  }))), 'lease_rents_lease_id_unit_id_effective_from_key');
  assert.equal(code(() => validateDraft(draft({ parties: [{ contact_id: 'C1', role: 'owner' as 'renter' }] }))), 'lease_parties_role_check');
});

test('activation needs a draft, a renter, a unit, a rent per unit and no future signature', () => {
  const d = lease({ status: 'draft', rents: [{ id: 'r', unit_id: 'U1', effective_from: '2026-01-01', rent_amount: 1, charges_amount: 0, created_at: '' }] });
  const renter = [{ contact_id: 'C1', role: 'renter' as const }];
  assert.equal(code(() => assertActivatable(d, ['U1'], renter, undefined, '2026-01-05')), 'no error');
  assert.equal(code(() => assertActivatable({ ...d, status: 'active' }, ['U1'], renter, undefined, '2026-01-05')), 'lease_not_draft');
  assert.equal(code(() => assertActivatable(d, ['U1'], [], undefined, '2026-01-05')), 'lease_needs_renter');
  assert.equal(code(() => assertActivatable(d, [], renter, undefined, '2026-01-05')), 'lease_needs_unit');
  assert.equal(code(() => assertActivatable(d, ['U1', 'U2'], renter, undefined, '2026-01-05')), 'lease_needs_rent');
  assert.equal(code(() => assertActivatable(d, ['U1'], renter, '2026-01-06', '2026-01-05')), 'lease_signed_in_future');
  assert.equal(code(() => assertActivatable({ ...d, registered_at: '2026-01-01' }, ['U1'], renter, undefined, '2026-01-05')), 'leases_registration_check');
});

test('renewal must move past both the end date and today', () => {
  const l = lease({ end_date: '2026-06-30' });
  assert.equal(code(() => assertRenewable(l, '2026-06-30', '2026-06-01')), 'lease_renewal_not_after');
  assert.equal(code(() => assertRenewable(l, '2026-07-05', '2026-07-05')), 'lease_renewal_not_after');
  assert.equal(code(() => assertRenewable(l, '2027-06-30', '2026-07-05')), 'no error');
  assert.equal(code(() => assertRenewable({ ...l, status: 'ended' }, '2027-06-30', '2026-07-05')), 'lease_not_active');
});

test('ending: not before start, not in the future once started, known reason', () => {
  const l = lease({ start_date: '2026-01-01' });
  assert.equal(assertEndable(l, '2026-03-01', undefined, '2026-03-10'), 'other');
  assert.equal(assertEndable(l, '2026-03-01', ' terminated_by_renter ', '2026-03-10'), 'terminated_by_renter');
  assert.equal(code(() => assertEndable(l, '2025-12-31', undefined, '2026-03-10')), 'lease_end_before_start');
  assert.equal(code(() => assertEndable(l, '2026-03-11', undefined, '2026-03-10')), 'lease_end_in_future');
  assert.equal(code(() => assertEndable(lease({ start_date: '2026-04-01' }), '2026-04-01', undefined, '2026-03-10')), 'no error');
  assert.equal(code(() => assertEndable(l, '2026-03-01', 'bored', '2026-03-10')), 'leases_end_reason_check');
});

test('unit is rented while any of its leases is active', () => {
  assert.equal(unitTarget([{ status: 'ended' }, { status: 'active' }]), 'rented');
  assert.equal(unitTarget([{ status: 'ended' }, { status: 'draft' }]), 'vacant');
});
