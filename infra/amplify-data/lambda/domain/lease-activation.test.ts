import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Lease } from './lease-rules.ts';
import { ACTIVATION_DOCUMENTS, activationGaps } from './lease-rules.ts';

const lease = (over: Partial<Lease> = {}): Lease => ({
  id: 'L1', organization_id: 'O', number: 1, status: 'draft', start_date: '2026-01-01', end_date: '2026-12-31',
  payment_day: 1, deposit_amount: 1000, rents: [], terms: [], created_at: '', updated_at: '', ...over,
});
const unit = (over: Record<string, unknown> = {}) => ({ id: 'U1', deposit_months: 2, reservation_deposit: 10000, ...over });
const ALL_DOCS = [...ACTIVATION_DOCUMENTS];

test('nothing missing: no approval needed', () => {
  assert.deepEqual(activationGaps(lease(), [unit()], ALL_DOCS), []);
});

test('lease deposit zero or missing is a gap', () => {
  assert.deepEqual(activationGaps(lease({ deposit_amount: 0 }), [unit()], ALL_DOCS), ['deposit_amount']);
  assert.deepEqual(activationGaps(lease({ deposit_amount: null as unknown as number }), [unit()], ALL_DOCS), ['deposit_amount']);
});

test('unit without deposit_months or reservation_deposit is a gap per unit', () => {
  const gaps = activationGaps(lease(), [unit({ id: 'U2', deposit_months: null, reservation_deposit: null })], ALL_DOCS);
  assert.deepEqual(gaps, ['unit:U2:deposit_months', 'unit:U2:reservation_deposit']);
});

test('each unit is checked on a multi-unit lease', () => {
  const gaps = activationGaps(lease(), [unit({ id: 'U1' }), unit({ id: 'U2', reservation_deposit: undefined })], ALL_DOCS);
  assert.deepEqual(gaps, ['unit:U2:reservation_deposit']);
});

test('each missing document is reported', () => {
  assert.deepEqual(activationGaps(lease(), [unit()], []), ACTIVATION_DOCUMENTS.map((d) => `doc:${d}`));
  assert.deepEqual(activationGaps(lease(), [unit()], ['signed_lease', 'registration_receipt']), ['doc:id_document']);
});

test('extra documents of other categories do not satisfy the rule', () => {
  assert.deepEqual(activationGaps(lease(), [unit()], ['other', 'inspection_report']), ACTIVATION_DOCUMENTS.map((d) => `doc:${d}`));
});
