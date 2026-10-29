// Integration: batch 1 (dashboard, biens, units, common areas) through the dispatcher on Floci.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from '../domain/test-env.ts';

const ready = await useDevTables();
const { doc, table, getItem } = await import('../domain/db.ts');
const { dispatch } = await import('./dispatch.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const BRANCH = randomUUID();
const manager = { role: 'manager', userId: 'u1', orgId: ORG };
const viewer = { role: 'viewer', userId: 'u2', orgId: ORG };
const outsider = { role: 'manager', userId: 'u3', orgId: randomUUID() };
const call = async (field: 'run' | 'exec', op: string, variables: Record<string, unknown>, caller = manager) =>
  JSON.parse(await dispatch(field, { op, variables: JSON.stringify(variables) }, caller));

before(async () => {
  if (!ready) return;
  await doc.send(new PutCommand({ TableName: table('Branch'), Item: { __typename: 'Branch', id: BRANCH, organization_id: ORG, name: 'Siège', city: 'Tunis' } }));
});

test('batch 1: biens, units, common areas, dashboard', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  const building = (await call('exec', 'AddProperty', { object: { name: 'Résidence B', type: 'building', branch_id: BRANCH, city: 'Tunis' } })).insert_properties_one.id;
  const house = (await call('exec', 'AddProperty', { object: { name: 'Villa', type: 'house', branch_id: BRANCH } })).insert_properties_one.id;

  await t.test('a house gets its MAISON unit; viewers and other orgs cannot write', async () => {
    const data = await call('run', 'Property', { id: house });
    assert.deepEqual(data.property.units.map((u: { code: string }) => u.code), ['MAISON']);
    await assert.rejects(call('exec', 'AddProperty', { object: { name: 'X', branch_id: BRANCH } }, viewer), /permission_denied/);
    assert.equal((await call('run', 'Property', { id: house }, outsider)).property, null);
  });

  await t.test('unit codes are unique among active units; archiving frees the code', async () => {
    const a1 = (await call('exec', 'AddUnit', { object: { property_id: building, code: 'A1', rent_amount: 900 } })).insert_units_one.id;
    await assert.rejects(call('exec', 'AddUnit', { object: { property_id: building, code: 'A1' } }), /units_property_id_code_key/);
    await call('exec', 'UpdateUnit', { id: a1, set: { archived_at: '2026-10-01T00:00:00Z' } });
    await call('exec', 'AddUnit', { object: { property_id: building, code: 'A1', rent_amount: 950 } });
    await assert.rejects(call('exec', 'UpdateUnit', { id: a1, set: { archived_at: null } }), /units_property_id_code_key/);
    await assert.rejects(call('exec', 'UpdateUnit', { id: a1, set: { energy_class: 'Z' } }), /units_energy_class_check/);
    await assert.rejects(call('exec', 'UpdateUnit', { id: a1, set: { organization_id: 'x' } }), /units_column_not_writable/);
  });

  await t.test('lists: biens with units, units overview, map, archives, branches', async () => {
    const list = await call('run', 'PropertiesWithUnits', {});
    assert.deepEqual(list.properties.map((p: { name: string }) => p.name), ['Résidence B', 'Villa']);
    assert.equal(list.properties[0].branch.name, 'Siège');
    const units = await call('run', 'UnitsOverview', {});
    assert.equal(units.units.length, 3);
    assert.equal(units.units[0].photoCount.aggregate.count, 0);
    await call('exec', 'SetPropertyArchived', { id: house, archived_at: '2026-10-20T00:00:00Z' });
    assert.deepEqual((await call('run', 'ArchivedProperties', {})).properties.map((p: { name: string }) => p.name), ['Villa']);
    assert.deepEqual((await call('run', 'PropertiesMap', {})).properties.map((p: { name: string }) => p.name), ['Résidence B']);
    assert.deepEqual((await call('run', 'Branches', {})).branches, [{ id: BRANCH, name: 'Siège', city: 'Tunis' }]);
  });

  await t.test('common areas and syndic shares', async () => {
    const area = (await call('exec', 'AddArea', { object: { property_id: building, name: 'Escalier', kind: 'stairs' } })).insert_common_areas_one.id;
    await call('exec', 'UpdateArea', { id: area, set: { notes: 'Bloc A' } });
    assert.deepEqual((await call('run', 'CommonAreas', { propertyId: building })).common_areas, [{ id: area, name: 'Escalier', kind: 'stairs', notes: 'Bloc A' }]);
    const units = (await call('run', 'Property', { id: building })).property.units as { id: string; archived_at: string | null }[];
    const live = units.filter((u) => !u.archived_at);
    await call('exec', 'SaveShares', { updates: live.map((u) => ({ where: { id: { _eq: u.id } }, _set: { common_share: 1000 } })) });
    assert.equal((await getItem('Unit', { id: live[0].id }))?.common_share, 1000);
    const overview = await call('run', 'CommonAreasOverview', {});
    assert.equal(overview.properties[0].common_areas_aggregate.aggregate.count, 1);
    await call('exec', 'DeleteArea', { id: area });
  });

  await t.test('dashboard counts', async () => {
    const d = await call('run', 'Dashboard', { today: '2026-10-24', dayStart: '2026-10-23T23:00:00Z', dayEnd: '2026-10-24T23:00:00Z' });
    assert.equal(d.properties.length, 1);
    assert.ok(d.record_gaps_aggregate.aggregate.count >= 1);
    assert.equal(d.appointments_today.aggregate.count, 0);
  });

  await t.test('delete: unreferenced unit goes with its files/listing/lock; referenced and foreign refused', async () => {
    const clean = (await call('exec', 'AddUnit', { object: { property_id: building, code: 'DEL1', rent_amount: 500 } })).insert_units_one.id;
    const leased = (await call('exec', 'AddUnit', { object: { property_id: building, code: 'DEL2' } })).insert_units_one.id;
    const junctioned = (await call('exec', 'AddUnit', { object: { property_id: building, code: 'DEL3' } })).insert_units_one.id;
    const at = new Date().toISOString();
    // A hand-seeded lease naming the unit, a LeaseUnit junction row, and one file link on the clean unit.
    await doc.send(new PutCommand({ TableName: table('Lease'), Item: { __typename: 'Lease', id: randomUUID(), organization_id: ORG, number: 1, status: 'draft', start_date: '2026-10-01', end_date: '2027-09-30', unit_ids: [leased], created_at: at, updated_at: at } }));
    await doc.send(new PutCommand({ TableName: table('LeaseUnit'), Item: { __typename: 'LeaseUnit', lease_id: 'lease-junction', unit_id: junctioned, organization_id: ORG, created_at: at, updated_at: at } }));
    const fileLink = randomUUID();
    await doc.send(new PutCommand({ TableName: table('FileLink'), Item: { __typename: 'FileLink', id: fileLink, organization_id: ORG, target_key: `unit#${clean}`, storage_file_id: 'sf1', kind: 'photo', title: 'x', sort_order: 0, created_at: at } }));
    await doc.send(new PutCommand({ TableName: table('PublicListing'), Item: { __typename: 'PublicListing', id: clean, organization_id: ORG, unit_id: clean, published_at: at } }));

    await assert.rejects(call('exec', 'DeleteUnit', { id: leased }), /unit_not_deletable/);
    await assert.rejects(call('exec', 'DeleteUnit', { id: junctioned }), /unit_not_deletable/);
    await assert.rejects(call('exec', 'DeleteUnit', { id: clean }, outsider), /unit_not_found/);

    await call('exec', 'DeleteUnit', { id: clean });
    assert.equal(await getItem('Unit', { id: clean }), undefined);
    assert.equal(await getItem('FileLink', { id: fileLink }), undefined);
    assert.equal(await getItem('PublicListing', { id: clean }), undefined);
    assert.equal(await getItem('Lock', { id: `UNIQ#unitcode#${building}#DEL1` }), undefined);

    // The deletion freed the code again.
    await call('exec', 'AddUnit', { object: { property_id: building, code: 'DEL1' } });
  });
});
