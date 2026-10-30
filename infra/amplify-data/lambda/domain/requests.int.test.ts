// Integration: website listing sync + visitor requests against the dev tables on Floci (fresh org per run).
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from './test-env.ts';

const ready = await useDevTables();
const { doc, table, getItem, queryAll } = await import('./db.ts');
const { syncPublicListing } = await import('./public-listings.ts');
const requests = await import('./requests.ts');
const { PutCommand, UpdateCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const STAFF = randomUUID();
const UNIT = randomUUID();
const PROPERTY = randomUUID();
const client = (id = randomUUID()) => ({ role: 'user', userId: id, orgId: '' });
const anonymous = { role: 'public', userId: '', orgId: '' };
const manager = { role: 'manager', userId: STAFF, orgId: ORG };
const HERE = randomUUID();
const ELSEWHERE = randomUUID();
const NOW = new Date('2026-05-04T08:00:00Z'); // a Monday

const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: '2026-01-01T00:00:00Z', updated_at: 'x', ...item } }));
const code = async (p: Promise<unknown>): Promise<string> => {
  try { await p; } catch (err) { return (err as { code?: string }).code ?? (err as Error).message; }
  return 'no error';
};
const rental = (over: Record<string, unknown> = {}) => ({
  unit_id: UNIT, start_date: '2026-06-01', duration_months: 12, full_name: 'Sana Ben Ali', phone: '+216 71 123 456', ...over,
});
const visit = (over: Record<string, unknown> = {}) => ({
  unit_id: UNIT, visit_date: '2026-05-05', visit_time: '10:00', full_name: 'Karim', phone: '98 765 432', ...over,
});

before(async () => {
  if (!ready) return;
  await put('Organization', { id: ORG, name: 'Agence', visit_payment_method: 'manual' });
  await put('StaffMember', { id: STAFF, organization_id: ORG, display_name: 'Staff', role: 'manager' });
  await put('StaffMember', { id: HERE, organization_id: ORG, display_name: 'Here', role: 'staff', confirmed_at: '2026-10-30T10:00:00Z', disabled_at: null });
  await put('StaffMember', { id: ELSEWHERE, organization_id: ORG, display_name: 'Elsewhere', role: 'staff', confirmed_at: '2026-10-30T10:00:00Z', disabled_at: null });
  await put('StaffAssignment', { id: randomUUID(), organization_id: ORG, user_id: HERE, branch_id: 'B', role: 'staff' });
  await put('StaffAssignment', { id: randomUUID(), organization_id: ORG, user_id: ELSEWHERE, branch_id: 'OTHER', role: 'staff' });
  await put('Property', { id: PROPERTY, organization_id: ORG, branch_id: 'B', name: 'Résidence', city: 'Tunis' });
  await put('Unit', { id: UNIT, organization_id: ORG, property_id: PROPERTY, code: 'A1', status: 'vacant', rent_amount: 900, show_on_website: true });
  await put('FileLink', { id: randomUUID(), organization_id: ORG, target_key: `unit#${UNIT}`, unit_id: UNIT, storage_file_id: 'f1', kind: 'photo', title: 'p', sort_order: 1 });
});

test('website listing and visitor requests', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  await t.test('listing appears when the unit qualifies', async () => {
    assert.equal(await syncPublicListing(UNIT), 'listed');
    assert.equal((await getItem('PublicListing', { id: UNIT }))?.visit_payment_method, 'manual');
  });

  await t.test('signed-in clients only; unlisted units refused', async () => {
    assert.equal(await code(requests.submitRentalRequest(anonymous, rental(), NOW)), 'REQUEST_LOGIN_REQUIRED');
    assert.equal(await code(requests.submitRentalRequest(client(), rental({ unit_id: randomUUID() }), NOW)), 'REQUEST_UNIT_UNAVAILABLE');
  });

  const renter = client();
  await t.test('rental request: stored, staff notified, duplicate refused, throttled after 3 per phone', async () => {
    const receipt = await requests.submitRentalRequest(renter, rental(), NOW);
    const stored = await getItem('RentalRequest', { id: receipt.id });
    assert.deepEqual([stored?.status, stored?.phone_digits, stored?.client_user_id], ['new', '21671123456', renter.userId]);
    const bell = await queryAll('Notification', { index: 'byUser', key: 'user_id', value: STAFF });
    assert.ok(bell.some((n) => n.kind === 'rental_request' && n.body === 'Sana Ben Ali - A1'));
    const hereBell = await queryAll('Notification', { index: 'byUser', key: 'user_id', value: HERE });
    assert.ok(hereBell.some((n) => n.kind === 'rental_request'), 'the staff member of the unit branch is notified');
    assert.equal((await queryAll('Notification', { index: 'byUser', key: 'user_id', value: ELSEWHERE })).length, 0, 'staff of another branch is not');
    assert.equal((await requests.updateRentalRequest(manager, receipt.id, { status: 'accepted' })).closed_outcome, undefined);
    assert.equal((await requests.updateRentalRequest(manager, receipt.id, { status: 'closed' })).closed_outcome, 'accepted');
    assert.equal((await requests.updateRentalRequest(manager, receipt.id, { status: 'new' })).closed_outcome, null);
    assert.equal(await code(requests.submitRentalRequest(renter, rental(), NOW)), 'REQUEST_DUPLICATE');
    await requests.submitRentalRequest(renter, rental({ duration_months: 24 }), NOW);
    await requests.submitRentalRequest(renter, rental({ duration_months: 36 }), NOW);
    assert.equal(await code(requests.submitRentalRequest(renter, rental({ duration_months: 48 }), NOW)), 'REQUEST_TOO_MANY');
  });

  await t.test('visit: invalid slot, confirm takes the slot, second confirm on it refused', async () => {
    assert.equal(await code(requests.submitVisitRequest(client(), visit({ visit_date: '2026-05-10' }), NOW)), 'REQUEST_INVALID');
    const a = await requests.submitVisitRequest(client(), visit(), NOW);
    const b = await requests.submitVisitRequest(client(), visit({ phone: '22 333 444' }), NOW);
    await requests.updateVisitRequest(manager, a.id, { status: 'confirmed' });
    assert.equal(await code(requests.submitVisitRequest(client(), visit({ phone: '55 666 777' }), NOW)), 'REQUEST_SLOT_TAKEN');
    assert.equal(await code(requests.updateVisitRequest(manager, b.id, { status: 'confirmed' })), 'visit_requests_one_confirmed_slot');
    await requests.updateVisitRequest(manager, a.id, { status: 'cancelled' });
    await requests.updateVisitRequest(manager, b.id, { status: 'confirmed' });
  });

  await t.test('listing disappears once the unit is rented', async () => {
    await doc.send(new UpdateCommand({ TableName: table('Unit'), Key: { id: UNIT }, UpdateExpression: 'SET #s = :r', ExpressionAttributeNames: { '#s': 'status' }, ExpressionAttributeValues: { ':r': 'rented' } }));
    assert.equal(await syncPublicListing(UNIT), 'unlisted');
    assert.equal(await getItem('PublicListing', { id: UNIT }), undefined);
  });
});
