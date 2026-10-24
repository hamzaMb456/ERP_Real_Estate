// Integration: batch 5 (requests, files, settings, gaps, storage ownership) through the dispatcher on Floci.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from '../domain/test-env.ts';

const ready = await useDevTables();
const { doc, table } = await import('../domain/db.ts');
const { dispatch } = await import('./dispatch.ts');
const { registerStorageFile } = await import('../domain/files.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const [ADMIN, PROPERTY, UNIT, VISIT_A, VISIT_B] = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const admin = { role: 'org_admin', userId: ADMIN, orgId: ORG };
const manager = { role: 'manager', userId: 'm1', orgId: ORG };
const call = async (field: 'run' | 'exec', op: string, variables: Record<string, unknown>, caller = admin) =>
  JSON.parse(await dispatch(field, { op, variables: JSON.stringify(variables) }, caller));
const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: '2026-10-01T00:00:00Z', updated_at: 'x', ...item } }));
const visit = (id: string, phone: string) => ({ id, organization_id: ORG, unit_id: UNIT, client_user_id: 'c', visit_date: '2026-11-05', visit_time: '10:00:00', full_name: 'V', phone, phone_digits: phone, status: 'new' });

before(async () => {
  if (!ready) return;
  await put('Organization', { id: ORG, name: 'Agence F' });
  await put('Property', { id: PROPERTY, organization_id: ORG, branch_id: 'B', name: 'Résidence F', city: 'Sousse' });
  await put('Unit', { id: UNIT, organization_id: ORG, property_id: PROPERTY, code: 'F1', status: 'vacant' });
  await put('VisitRequest', visit(VISIT_A, '71000001'));
  await put('VisitRequest', visit(VISIT_B, '71000002'));
});

test('batch 5: requests, files, settings, gaps', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  await t.test('visit requests list with unit; confirm creates the appointment; a taken slot rolls it back', async () => {
    const list = (await call('run', 'VisitRequests', {})).visit_requests;
    assert.equal(list[0].unit.property.city, 'Sousse');
    assert.equal(list[0].phone_digits, undefined);
    const appointment = (id: string) => ({ id, kind: 'viewing', title: 'Visite F1', starts_at: '2026-11-05T09:00:00Z', ends_at: '2026-11-05T09:30:00Z', unit_id: UNIT });
    const a1 = randomUUID();
    await call('exec', 'ConfirmVisit', { appointment: appointment(a1), id: VISIT_A, appointmentId: a1 });
    const a2 = randomUUID();
    await assert.rejects(call('exec', 'ConfirmVisit', { appointment: appointment(a2), id: VISIT_B, appointmentId: a2 }), /visit_requests_one_confirmed_slot/);
    assert.equal((await call('run', 'Appointment', { id: a2 })).appointment, null);
    await call('exec', 'CloseVisit', { id: VISIT_A, status: 'done', appointmentId: a1, appointmentStatus: 'done' });
    assert.equal((await call('run', 'Appointment', { id: a1 })).appointment.status, 'done');
  });

  await t.test('photos: link, list, cover, order; storage ownership', async () => {
    const f1 = randomUUID();
    const f2 = randomUUID();
    await registerStorageFile(ADMIN, f1, 'property-files');
    await registerStorageFile(ADMIN, f2, 'property-files');
    const p1 = (await call('exec', 'LinkFile', { object: { unit_id: UNIT, storage_file_id: f1, kind: 'photo', title: 'Salon', sort_order: 1 } })).insert_property_files_one.id;
    const p2 = (await call('exec', 'LinkFile', { object: { unit_id: UNIT, storage_file_id: f2, kind: 'photo', title: 'Cuisine', sort_order: 2 } })).insert_property_files_one.id;
    await call('exec', 'SetCover', { id: p2, others: {} });
    await call('exec', 'SwapOrder', { a: p1, aOrder: 2, b: p2, bOrder: 1 });
    const photos = (await call('run', 'Photos', { where: { unit_id: { _eq: UNIT }, kind: { _eq: 'photo' } } })).property_files;
    assert.deepEqual(photos.map((p: { id: string; is_cover: boolean }) => [p.id, p.is_cover]), [[p2, true], [p1, false]]);
    assert.deepEqual((await call('run', 'StorageFileOwnership', { key: f1 }, manager)).property_files, [{ id: p1 }]);
    assert.deepEqual((await call('run', 'StorageFileOwnership', { key: f1 }, { role: 'manager', userId: 'x', orgId: randomUUID() })).property_files, []);
  });

  await t.test('visit payment method: org_admin only, listings follow', async () => {
    await assert.rejects(call('exec', 'SetVisitPaymentMethod', { id: ORG, value: 'manual' }, manager), /permission_denied/);
    await call('exec', 'SetVisitPaymentMethod', { id: ORG, value: 'manual' });
    assert.deepEqual((await call('run', 'VisitPaymentMethod', {})).organizations, [{ id: ORG, visit_payment_method: 'manual' }]);
    await assert.rejects(call('exec', 'SetVisitPaymentMethod', { id: ORG, value: 'bitcoin' }), /visit_payment_method_check/);
  });

  await t.test('record gaps', async () => {
    const gaps = (await call('run', 'RecordGaps', {})).record_gaps.map((g: { gap_code: string }) => g.gap_code);
    assert.ok(gaps.includes('no_owner') && gaps.includes('no_position'));
  });
});
