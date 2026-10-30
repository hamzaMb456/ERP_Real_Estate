import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertRentalTerms, cleanContact, closedOutcome, isThrottled, normalizeVisitSlot, phoneDigits, requestRecipients } from './request-rules.ts';

const code = (fn: () => unknown): string => {
  try { fn(); } catch (err) { return (err as { code: string }).code; }
  return 'no error';
};

test('contact details: trimmed, sane name, phone with 7+ digits, valid email', () => {
  assert.deepEqual(cleanContact({ full_name: '  Sana B ', phone: ' +216 (71) 123-456 ', email: ' ', message: '' }),
    { full_name: 'Sana B', phone: '+216 (71) 123-456', phone_digits: '21671123456', email: null, message: null });
  assert.equal(code(() => cleanContact({ full_name: 'A', phone: '71123456' })), 'REQUEST_INVALID');
  assert.equal(code(() => cleanContact({ full_name: 'Ali <b>', phone: '71123456' })), 'REQUEST_INVALID');
  assert.equal(code(() => cleanContact({ full_name: 'Ali‮', phone: '71123456' })), 'REQUEST_INVALID');
  assert.equal(code(() => cleanContact({ full_name: 'Ali', phone: '12-34' })), 'REQUEST_INVALID');
  assert.equal(code(() => cleanContact({ full_name: 'Ali', phone: '71123456', email: 'x@y' })), 'REQUEST_INVALID');
  assert.equal(phoneDigits('+216 71'), '21671');
});

test('rental terms: from today within a year, 1 to 120 months', () => {
  assert.equal(code(() => assertRentalTerms('2026-05-04', 12, '2026-05-04')), 'no error');
  assert.equal(code(() => assertRentalTerms('2026-05-03', 12, '2026-05-04')), 'REQUEST_INVALID');
  assert.equal(code(() => assertRentalTerms('2027-05-05', 12, '2026-05-04')), 'REQUEST_INVALID');
  assert.equal(code(() => assertRentalTerms('2026-06-01', 121, '2026-05-04')), 'REQUEST_INVALID');
});

test('visit slot: tomorrow to +30 days, not Sunday, half hours 09:00-17:30', () => {
  assert.equal(normalizeVisitSlot('2026-05-05', '09:30', '2026-05-04'), '09:30:00');
  assert.equal(normalizeVisitSlot('2026-05-05', '17:30:00', '2026-05-04'), '17:30:00');
  for (const [date, time] of [['2026-05-04', '10:00'], ['2026-05-10', '10:00'], ['2026-06-04', '10:00'], ['2026-05-05', '08:30'], ['2026-05-05', '18:00'], ['2026-05-05', '10:15']]) {
    assert.equal(code(() => normalizeVisitSlot(date, time, '2026-05-04')), 'REQUEST_INVALID', `${date} ${time}`);
  }
});

test('throttle: 3 per phone per hour, 30 per org per 10 minutes', () => {
  const now = new Date('2026-05-04T12:00:00Z');
  const at = (minutesAgo: number, digits = '71123456') => ({ phone_digits: digits, created_at: new Date(now.getTime() - minutesAgo * 60_000).toISOString() });
  assert.equal(isThrottled([at(10), at(20)], '71123456', now), false);
  assert.equal(isThrottled([at(10), at(20), at(59)], '71123456', now), true);
  assert.equal(isThrottled([at(10), at(20), at(61)], '71123456', now), false);
  assert.equal(isThrottled(Array.from({ length: 30 }, (_, i) => at(1, `${i}`.padStart(8, '0'))), '99999999', now), true);
});

const member = (id: string, role: string, over: Record<string, unknown> = {}) => ({ id, role, confirmed_at: '2026-10-30T10:00:00Z', disabled_at: null, ...over });

test('a new request is announced to managers and to the regional staff of the unit branch, never to a locked account', () => {
  const staff = [
    member('m1', 'manager'), member('a1', 'org_admin'), member('v1', 'viewer'),
    member('s-here', 'staff'), member('s-else', 'staff'), member('s-off', 'staff', { disabled_at: '2026-10-31T00:00:00Z' }),
    member('s-new', 'staff', { confirmed_at: null }), member('m-off', 'manager', { disabled_at: '2026-10-31T00:00:00Z' }),
  ];
  const here = new Set(['s-here', 's-off', 's-new']);
  assert.deepEqual(requestRecipients(staff, here).map((m) => m.id), ['m1', 'a1', 's-here']);
});

test('a manager whose record has no confirmation date still hears about requests (managers are not invited)', () => {
  assert.deepEqual(requestRecipients([member('m1', 'manager', { confirmed_at: undefined })], new Set()).map((m) => m.id), ['m1']);
});

test('a closed rental request keeps its outcome: accepted stays accepted, anything else is a refusal', () => {
  assert.equal(closedOutcome('accepted', null), 'accepted');
  assert.equal(closedOutcome('contacted', null), 'rejected');
  assert.equal(closedOutcome('new', null), 'rejected');
  assert.equal(closedOutcome('closed', 'accepted'), 'accepted');
  assert.equal(closedOutcome('closed', null), 'rejected');
});
