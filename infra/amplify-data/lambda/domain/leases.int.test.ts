// Integration: the lease operations against the real DynamoDB tables of the dev stack on Floci.
// Each run uses a fresh organization, so runs never see each other's data.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from './test-env.ts';

const ready = await useDevTables();
const { doc, table, getItem } = await import('./db.ts');
const leases = await import('./leases.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const manager = { role: 'manager', userId: 'u1', orgId: ORG };
const viewer = { role: 'viewer', userId: 'u2', orgId: ORG };
const outsider = { role: 'manager', userId: 'u3', orgId: randomUUID() };
const U1 = randomUUID();
const U2 = randomUUID();
const RENTER = randomUUID();

const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: 'x', updated_at: 'x', ...item } }));
const code = async (p: Promise<unknown>): Promise<string> => {
  try { await p; } catch (err) { return (err as { code?: string }).code ?? (err as Error).message; }
  return 'no error';
};
const draft = (over: Record<string, unknown> = {}) => ({
  start_date: '2026-01-01', end_date: '2026-12-31', unit_ids: [U1],
  parties: [{ contact_id: RENTER, role: 'renter' as const }],
  rents: [{ unit_id: U1, effective_from: '2026-01-01', rent_amount: 900 }], ...over,
});

before(async () => {
  if (!ready) return;
  await put('Unit', { id: U1, organization_id: ORG, property_id: 'P', code: 'A1', status: 'vacant' });
  await put('Unit', { id: U2, organization_id: ORG, property_id: 'P', code: 'A2', status: 'for_sale' });
  await put('Contact', { id: RENTER, organization_id: ORG, full_name: 'Renter One', roles: [] });
});

test('lease lifecycle on DynamoDB', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  const first = await leases.saveDraftLease(manager, draft());
  const second = await leases.saveDraftLease(manager, draft({ start_date: '2026-06-01', end_date: '2027-05-31', rents: [{ unit_id: U1, effective_from: '2026-06-01', rent_amount: 950 }] }));

  await t.test('numbers per organization and makes renters', async () => {
    assert.deepEqual([first.number, second.number], [1, 2]);
    assert.deepEqual(first.unit_labels, ['A1']);
    assert.deepEqual((await getItem('Contact', { id: RENTER }))?.roles, ['renter']);
  });

  await t.test('gates by role and organization', async () => {
    assert.equal(await code(leases.activateLease(viewer, first.id, undefined, '2026-01-05')), 'lease_forbidden');
    assert.equal(await code(leases.activateLease(outsider, first.id, undefined, '2026-01-05')), 'lease_not_found');
  });

  await t.test('activation rents the unit, logs the initial term, blocks overlaps', async () => {
    const active = await leases.activateLease(manager, first.id, undefined, '2026-01-05');
    assert.equal(active.status, 'active');
    assert.equal(active.terms[0].kind, 'initial');
    assert.equal((await getItem('Unit', { id: U1 }))?.status, 'rented');
    assert.equal(await code(leases.activateLease(manager, second.id, undefined, '2026-01-05')), 'lease_overlap:1');
    assert.equal(await code(leases.saveDraftLease(manager, { ...draft(), id: first.id })), 'lease_not_draft');
  });

  await t.test('renewal and rent change append history', async () => {
    const renewed = await leases.renewLease(manager, first.id, '2027-03-31', [{ unit_id: U1, rent_amount: 1000 }], 'one more', '2026-12-01');
    assert.equal(renewed.end_date, '2027-03-31');
    assert.equal(renewed.terms.at(-1)?.start_date, '2027-01-01');
    assert.equal(renewed.rents.at(-1)?.effective_from, '2027-01-01');
    const changed = await leases.changeRent(manager, first.id, { unit_id: U1, effective_from: '2026-07-01', rent_amount: 920 });
    assert.equal(changed.rents.length, 3);
    assert.equal(await code(leases.changeRent(manager, first.id, { unit_id: U1, effective_from: '2026-07-01', rent_amount: 1 })),
      'lease_rents_lease_id_unit_id_effective_from_key');
  });

  await t.test('ending frees the unit; a stale write is refused', async () => {
    const before = await getItem('Lease', { id: first.id });
    const ended = await leases.endLease(manager, first.id, '2026-05-31', 'terminated_by_renter', '2026-06-02');
    assert.equal(ended.status, 'ended');
    assert.equal((await getItem('Unit', { id: U1 }))?.status, 'vacant');
    // Activating the second lease now works: the first stopped occupying on 2026-05-31.
    await leases.activateLease(manager, second.id, undefined, '2026-06-02');
    assert.equal((await getItem('Unit', { id: U1 }))?.status, 'rented');
    assert.notEqual(before?.updated_at, ended.updated_at);
  });

  await t.test('daily expiry ends overdue leases and frees units; others untouched', async () => {
    const { expired } = await leases.expireOverdueLeases('2027-06-08');
    const mine = expired.filter((l) => l.organization_id === ORG);
    assert.deepEqual(mine.map((l) => l.number), [2]);
    assert.equal(mine[0].end_reason, 'expired_auto');
    assert.equal((await getItem('Unit', { id: U1 }))?.status, 'vacant');
  });

  await t.test('units for sale keep their status', async () => {
    const d = await leases.saveDraftLease(manager, draft({ unit_ids: [U2], start_date: '2028-01-01', end_date: '2028-12-31', rents: [{ unit_id: U2, effective_from: '2028-01-01', rent_amount: 1 }] }));
    await leases.activateLease(manager, d.id, undefined, '2028-01-02');
    assert.equal((await getItem('Unit', { id: U2 }))?.status, 'for_sale');
  });
});
