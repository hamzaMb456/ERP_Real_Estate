// Integration: file links against the dev tables on Floci (fresh org per run).
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from './test-env.ts';

const ready = await useDevTables();
const { doc, table, getItem } = await import('./db.ts');
const files = await import('./files.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const ME = randomUUID();
const manager = { role: 'manager', userId: ME, orgId: ORG };
const otherOrgManager = { role: 'manager', userId: randomUUID(), orgId: randomUUID() };
const STAFF = randomUUID();
const staff = { role: 'staff', userId: STAFF, orgId: ORG };
const outsider = { role: 'staff', userId: randomUUID(), orgId: ORG };
const UNIT = randomUUID();
const PROPERTY = randomUUID();

const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: '2026-01-01T00:00:00Z', updated_at: 'x', ...item } }));
const code = async (p: Promise<unknown>): Promise<string> => {
  try { await p; } catch (err) { return (err as { code?: string }).code ?? (err as Error).message; }
  return 'no error';
};
const upload = async (bucket: 'property-files' | 'lease-files' = 'property-files', who = ME) => {
  const id = randomUUID();
  await files.registerStorageFile(who, id, bucket);
  return id;
};

before(async () => {
  if (!ready) return;
  await put('StaffAssignment', { id: randomUUID(), organization_id: ORG, user_id: STAFF, branch_id: 'B', role: 'staff' });
  await put('Property', { id: PROPERTY, organization_id: ORG, branch_id: 'B', name: 'Résidence' });
  await put('Unit', { id: UNIT, organization_id: ORG, property_id: PROPERTY, code: 'C1', status: 'vacant', rent_amount: 800, show_on_website: true });
});

test('file links on DynamoDB', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  await t.test('storage must be in the right bucket and uploaded by the caller', async () => {
    assert.equal(await code(files.linkFile(manager, { unit_id: UNIT, storage_file_id: await upload('lease-files'), title: 'x' })), 'invalid_storage_file');
    assert.equal(await code(files.linkFile(manager, { unit_id: UNIT, storage_file_id: await upload('property-files', randomUUID()), title: 'x' })), 'invalid_storage_file');
    assert.equal(await code(files.linkFile(manager, { unit_id: UNIT, kind: 'document', storage_file_id: await upload(), title: 'x' })), 'property_files_category_matches_kind');
  });

  const first = await files.linkFile(manager, { unit_id: UNIT, storage_file_id: await upload(), title: 'Salon', is_cover: true });

  await t.test('a photo puts the unit on the website; one cover per unit; one link per file', async () => {
    assert.equal((await getItem('PublicListing', { id: UNIT }))?.cover_file_id, first.storage_file_id);
    assert.equal(await code(files.linkFile(manager, { unit_id: UNIT, storage_file_id: await upload(), title: 'Cuisine', is_cover: true })), 'property_files_one_cover');
    assert.equal(await code(files.linkFile(manager, { property_id: PROPERTY, storage_file_id: first.storage_file_id, title: 'dup' })), 'property_files_storage_file_id_key');
  });

  await t.test('setCover moves the cover; access check follows the organization', async () => {
    const second = await files.linkFile(manager, { unit_id: UNIT, storage_file_id: await upload(), title: 'Cuisine', sort_order: 2 });
    await files.setCover(manager, second.id);
    assert.equal((await getItem('FileLink', { id: first.id }))?.is_cover, false);
    assert.equal((await getItem('PublicListing', { id: UNIT }))?.cover_file_id, second.storage_file_id);
    assert.equal(await files.canAccessStorageFile(manager, second.storage_file_id), true);
    assert.equal(await files.canAccessStorageFile(otherOrgManager, second.storage_file_id), false);
  });

  await t.test('unlinking every photo takes the unit off the website', async () => {
    const remaining = [first.id];
    const cover = (await getItem('Lock', { id: `COVER#unit#${UNIT}` }))?.file_id as string;
    for (const id of [...remaining, cover]) await files.unlinkFile(manager, id);
    assert.equal(await getItem('PublicListing', { id: UNIT }), undefined);
  });

  await t.test('regional staff remove the photos of their branch, never the documents', async () => {
    const photo = await files.linkFile(staff, { unit_id: UNIT, storage_file_id: await upload('property-files', STAFF), title: 'Salon' });
    const plan = await files.linkFile(manager, { unit_id: UNIT, kind: 'document', category: 'plan', storage_file_id: await upload(), title: 'Plan' });
    assert.equal(await code(files.forgetStorageFile(staff, plan.storage_file_id)), 'file_delete_forbidden');
    assert.ok(await getItem('FileLink', { id: plan.id }));
    assert.equal(await code(files.forgetStorageFile(staff, photo.storage_file_id)), 'no error');
    assert.equal(await getItem('FileLink', { id: photo.id }), undefined);
    await files.forgetStorageFile(manager, plan.storage_file_id);
  });

  await t.test('staff of another branch cannot remove a photo, and an unlinked upload is removable by its uploader', async () => {
    const photo = await files.linkFile(manager, { unit_id: UNIT, storage_file_id: await upload(), title: 'Cuisine' });
    assert.equal(await code(files.forgetStorageFile(outsider, photo.storage_file_id)), 'invalid_storage_file');
    assert.ok(await getItem('FileLink', { id: photo.id }));
    await files.unlinkFile(manager, photo.id);
    const orphan = await upload('property-files', STAFF);
    assert.equal(await code(files.forgetStorageFile(staff, orphan)), 'no error');
  });
});
