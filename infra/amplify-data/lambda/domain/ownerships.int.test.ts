// Integration: ownership changes against the dev stack's tables on Floci (fresh org per run).
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from './test-env.ts';

const ready = await useDevTables();
const { doc, table, getItem } = await import('./db.ts');
const { changeOwnerships, refreshCurrentOwners } = await import('./ownerships.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const manager = { role: 'manager', userId: 'u1', orgId: ORG };
const viewer = { role: 'viewer', userId: 'u2', orgId: ORG };
const UNIT = randomUUID();
const [A, B, C] = [randomUUID(), randomUUID(), randomUUID()];

const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: 'x', updated_at: 'x', ...item } }));
const code = async (p: Promise<unknown>): Promise<string> => {
  try { await p; } catch (err) { return (err as { code?: string }).code ?? (err as Error).message; }
  return 'no error';
};

before(async () => {
  if (!ready) return;
  await put('Unit', { id: UNIT, organization_id: ORG, property_id: 'P', code: 'B1', status: 'vacant' });
  for (const id of [A, B, C]) await put('Contact', { id, organization_id: ORG, full_name: id.slice(0, 4), roles: [] });
});

test('ownership changes on DynamoDB', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  await t.test('viewer cannot change ownerships', async () => {
    assert.equal(await code(changeOwnerships(viewer, UNIT, { upsert: [] })), 'permission_denied');
  });

  const first = await changeOwnerships(manager, UNIT, { upsert: [{ contact_id: A, share_percent: 100, starts_on: '2026-01-01' }] }, '2026-02-01');

  await t.test('first owner: snapshot on the unit and the owner role', async () => {
    assert.deepEqual((await getItem('Unit', { id: UNIT }))?.current_owners, [{ contact_id: A, share_percent: 100 }]);
    assert.deepEqual((await getItem('Contact', { id: A }))?.roles, ['owner']);
  });

  await t.test('over the cap is refused with the first day', async () => {
    assert.equal(await code(changeOwnerships(manager, UNIT, { upsert: [{ contact_id: B, share_percent: 10, starts_on: '2026-03-01' }] })),
      'ownership_shares_exceeded:01/03/2026');
  });

  const transferred = await changeOwnerships(manager, UNIT, {
    upsert: [{ ...first[0], ends_on: '2026-06-30' }, { contact_id: B, share_percent: 100, starts_on: '2026-07-01' }],
  }, '2026-07-01');

  await t.test('a transfer (end A, start B) passes as one change', async () => {
    assert.equal(transferred.length, 2);
    assert.deepEqual((await getItem('Unit', { id: UNIT }))?.current_owners, [{ contact_id: B, share_percent: 100 }]);
  });

  await t.test('same contact twice overlapping is refused; split, then removal', async () => {
    assert.equal(await code(changeOwnerships(manager, UNIT, { upsert: [{ contact_id: B, share_percent: 1, starts_on: '2026-08-01' }] })), 'ownerships_no_overlap');
    const b = transferred.find((r) => r.contact_id === B)!;
    const split = await changeOwnerships(manager, UNIT, {
      upsert: [{ ...b, share_percent: 50 }, { contact_id: C, share_percent: 50, starts_on: '2027-01-01' }],
    }, '2026-07-01');
    const c = split.find((r) => r.contact_id === C)!;
    const removed = await changeOwnerships(manager, UNIT, { remove: [c.id] }, '2026-07-01');
    assert.equal(removed.some((r) => r.contact_id === C), false);
    await changeOwnerships(manager, UNIT, { upsert: [{ contact_id: C, share_percent: 50, starts_on: '2027-01-01' }] }, '2026-07-01');
  });

  await t.test('daily refresh picks up an ownership starting today', async () => {
    const { refreshed } = await refreshCurrentOwners('2027-01-01');
    assert.ok(refreshed >= 1);
    const owners = (await getItem('Unit', { id: UNIT }))?.current_owners;
    assert.deepEqual(owners?.map((o: { contact_id: string }) => o.contact_id).sort(), [B, C].sort());
  });
});
