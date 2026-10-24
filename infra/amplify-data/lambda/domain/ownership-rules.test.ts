import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Ownership } from './ownership-rules.ts';
import { assertNoContactOverlap, assertSharesCap, currentOwners, firstDayOverCap, validateOwnership } from './ownership-rules.ts';

const own = (over: Partial<Ownership>): Ownership => ({
  id: Math.random().toString(36), organization_id: 'O', unit_id: 'U', contact_id: 'A',
  share_percent: 50, starts_on: '2026-01-01', ends_on: null, created_at: '', updated_at: '', ...over,
});
const code = (fn: () => unknown): string => {
  try { fn(); } catch (err) { return (err as { code: string }).code; }
  return 'no error';
};

test('column checks: share in (0,100] with 2 decimals, end not before start', () => {
  assert.equal(code(() => validateOwnership(own({ share_percent: 33.33 }))), 'no error');
  assert.equal(code(() => validateOwnership(own({ share_percent: 0 }))), 'ownerships_share_percent_check');
  assert.equal(code(() => validateOwnership(own({ share_percent: 100.01 }))), 'ownerships_share_percent_check');
  assert.equal(code(() => validateOwnership(own({ share_percent: 33.333 }))), 'ownerships_share_percent_check');
  assert.equal(code(() => validateOwnership(own({ ends_on: '2025-12-31' }))), 'ownerships_dates_check');
});

test('same contact cannot hold overlapping periods; consecutive ones are fine', () => {
  assert.equal(code(() => assertNoContactOverlap([own({ ends_on: '2026-06-30' }), own({ starts_on: '2026-07-01' })])), 'no error');
  assert.equal(code(() => assertNoContactOverlap([own({ ends_on: '2026-06-30' }), own({ starts_on: '2026-06-30' })])), 'ownerships_no_overlap');
  assert.equal(code(() => assertNoContactOverlap([own({}), own({ contact_id: 'B' })])), 'no error');
});

test('cap: 100 % per day, checked on start dates, a transfer passes, exact thirds pass', () => {
  const transfer = [own({ share_percent: 100, ends_on: '2026-06-30' }), own({ contact_id: 'B', share_percent: 100, starts_on: '2026-07-01' })];
  assert.equal(firstDayOverCap(transfer), null);
  assert.equal(firstDayOverCap([own({ share_percent: 60 }), own({ contact_id: 'B', share_percent: 50, starts_on: '2026-03-15' })]), '2026-03-15');
  assert.equal(firstDayOverCap([33.34, 33.33, 33.33].map((s, i) => own({ contact_id: `C${i}`, share_percent: s }))), null);
  assert.equal(code(() => assertSharesCap([own({ share_percent: 60 }), own({ contact_id: 'B', share_percent: 50, starts_on: '2026-03-15' })])),
    'ownership_shares_exceeded:15/03/2026');
});

test('current owners on a day, largest share first', () => {
  const rows = [own({ share_percent: 30 }), own({ contact_id: 'B', share_percent: 70 }), own({ contact_id: 'C', starts_on: '2027-01-01' })];
  assert.deepEqual(currentOwners(rows, '2026-05-01'), [{ contact_id: 'B', share_percent: 70 }, { contact_id: 'A', share_percent: 30 }]);
});
