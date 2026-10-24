// Integration: batch 2 (contacts, ownerships) through the dispatcher on Floci.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from '../domain/test-env.ts';

const ready = await useDevTables();
const { doc, table } = await import('../domain/db.ts');
const { dispatch } = await import('./dispatch.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const UNIT = randomUUID();
const PROPERTY = randomUUID();
const manager = { role: 'manager', userId: 'u1', orgId: ORG };
const call = async (field: 'run' | 'exec', op: string, variables: Record<string, unknown>, caller = manager) =>
  JSON.parse(await dispatch(field, { op, variables: JSON.stringify(variables) }, caller));

before(async () => {
  if (!ready) return;
  await doc.send(new PutCommand({ TableName: table('Property'), Item: { __typename: 'Property', id: PROPERTY, organization_id: ORG, branch_id: 'B', name: 'Résidence C' } }));
  await doc.send(new PutCommand({ TableName: table('Unit'), Item: { __typename: 'Unit', id: UNIT, organization_id: ORG, property_id: PROPERTY, code: 'C1', status: 'vacant', updated_at: 'x' } }));
});

test('batch 2: contacts and ownerships', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  const ali = (await call('exec', 'AddContact', { object: { full_name: 'Ali Ben Salah', phone: '71 000 000', roles: { data: [{ role: 'buyer' }] } } })).insert_contacts_one.id;
  const sana = (await call('exec', 'AddContact', { object: { full_name: 'Sana Trabelsi', email: 'sana@example.test' } })).insert_contacts_one.id;

  await t.test('contact roles, edit, duplicates, options', async () => {
    await call('exec', 'UpdateContact', { id: ali, set: { notes: 'VIP' }, removed: ['buyer'], added: [{ contact_id: ali, role: 'renter' }] });
    const contact = (await call('run', 'Contact', { id: ali })).contact;
    assert.deepEqual([contact.notes, contact.roles], ['VIP', [{ role: 'renter' }]]);
    await assert.rejects(call('exec', 'UpdateContact', { id: ali, set: { is_organization: true }, removed: [], added: [] }), /contacts_column_not_writable/);
    const dupes = await call('run', 'ContactDuplicates', { where: { _or: [{ full_name: { _ilike: '%ben salah%' } }] } });
    assert.deepEqual(dupes.contacts.map((x: { id: string }) => x.id), [ali]);
    assert.equal((await call('run', 'ContactOptions', {})).contacts.length, 2);
  });

  await t.test('ownership: add, transfer as one change, delete with reopen; counts follow', async () => {
    const first = (await call('exec', 'AddOwnership', { object: { unit_id: UNIT, contact_id: ali, share_percent: 100, starts_on: '2020-01-01' } })).insert_ownerships_one.id;
    assert.ok(first);
    await call('exec', 'TransferOwnership', { endIds: [first], endOn: '2024-12-31', objects: [{ unit_id: UNIT, contact_id: sana, share_percent: 100, starts_on: '2025-01-01' }] });
    const rows = (await call('run', 'UnitOwnerships', { unitId: UNIT })).ownerships;
    assert.deepEqual(rows.map((r: { contact: { full_name: string } }) => r.contact.full_name), ['Sana Trabelsi', 'Ali Ben Salah']);
    const contacts = (await call('run', 'Contacts', {})).contacts;
    assert.equal(contacts.find((x: { id: string }) => x.id === sana).current_ownerships_aggregate.aggregate.count, 1);
    const owned = (await call('run', 'ContactOwnerships', { contactId: sana })).ownerships;
    assert.equal(owned[0].unit.property.name, 'Résidence C');
    const sanaRow = rows.find((r: { contact_id: string }) => r.contact_id === sana);
    await call('exec', 'DeleteOwnership', { id: sanaRow.id, reopen: [first] });
    const after = (await call('run', 'UnitOwnerships', { unitId: UNIT })).ownerships;
    assert.deepEqual(after.map((r: { contact_id: string; ends_on: string | null }) => [r.contact_id, r.ends_on]), [[ali, null]]);
  });

  await t.test('archiving and contact leases (none yet)', async () => {
    await call('exec', 'SetContactArchived', { id: sana, archived_at: '2026-10-24T00:00:00Z' });
    assert.equal((await call('run', 'ContactOptions', {})).contacts.length, 1);
    assert.deepEqual((await call('run', 'ContactLeases', { id: ali, role: 'renter' })).lease_parties, []);
  });
});
