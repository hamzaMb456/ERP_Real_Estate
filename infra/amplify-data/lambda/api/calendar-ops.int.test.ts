// Integration: batch 4 (calendar, notifications) through the dispatcher on Floci.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from '../domain/test-env.ts';

const ready = await useDevTables();
const { doc, table } = await import('../domain/db.ts');
const { dispatch } = await import('./dispatch.ts');
const { insertNotification } = await import('../domain/notifications.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const [STAFF, CONTACT, LEASE, UNIT, PROPERTY] = [randomUUID(), randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const manager = { role: 'manager', userId: STAFF, orgId: ORG };
const call = async (field: 'run' | 'exec', op: string, variables: Record<string, unknown>) =>
  JSON.parse(await dispatch(field, { op, variables: JSON.stringify(variables) }, manager));
const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: '2026-01-01T00:00:00Z', updated_at: 'x', ...item } }));

before(async () => {
  if (!ready) return;
  await put('StaffMember', { id: STAFF, organization_id: ORG, display_name: 'Nadia', email: 'n@example.test', role: 'manager' });
  await put('Contact', { id: CONTACT, organization_id: ORG, full_name: 'Prospect P' });
  await put('Property', { id: PROPERTY, organization_id: ORG, branch_id: 'BR', name: 'Résidence E' });
  await put('Unit', { id: UNIT, organization_id: ORG, property_id: PROPERTY, code: 'E1', status: 'rented' });
  await put('Lease', { id: LEASE, organization_id: ORG, number: 7, status: 'active', start_date: '2026-11-01', end_date: '2027-10-31', unit_ids: [UNIT], signed_at: '2026-10-01', rents: [], terms: [] });
});

test('batch 4: calendar and notifications', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  const id = randomUUID();
  await call('exec', 'InsertAppointment', {
    appointment: { id, kind: 'viewing', title: 'Visite E1', starts_at: '2026-11-03T09:00:00Z', ends_at: '2026-11-03T10:00:00Z', unit_id: UNIT, assigned_user_id: STAFF },
    participants: [{ appointment_id: id, contact_id: CONTACT, role: 'prospect' }],
  });

  await t.test('feed: appointment + lease all-day events in the window, branch from the unit', async () => {
    const feed = (await call('run', 'CalendarFeed', { from: '2026-10-31T23:00:00Z', to: '2026-11-30T23:00:00Z' })).calendar_feed;
    const kinds = feed.map((r: { kind: string }) => r.kind);
    assert.deepEqual(kinds, ['lease_start', 'viewing', 'registration_deadline']);
    assert.equal(feed[1].branch_id, 'BR');
    assert.deepEqual(feed[1].contact_ids, [CONTACT]);
    const rows = (await call('run', 'CalendarFeedRows', { where: { source: { _eq: 'appointment' }, ends_at: { _gte: '2026-11-01T00:00:00+01:00' } } })).calendar_feed;
    assert.deepEqual(rows.map((r: { appointment_id: string }) => r.appointment_id), [id]);
  });

  await t.test('detail, lookups, contact appointments', async () => {
    const a = (await call('run', 'Appointment', { id })).appointment;
    assert.deepEqual([a.assigned_user.display_name, a.unit.property.name, a.participants[0].contact.full_name], ['Nadia', 'Résidence E', 'Prospect P']);
    assert.equal((await call('run', 'CalendarLookups', {})).staff_members[0].user_id, STAFF);
    assert.equal((await call('run', 'ContactAppointments', { contactId: CONTACT })).appointment_participants[0].appointment.id, id);
  });

  await t.test('dynamic update (move + participant removed), status, resend', async () => {
    await call('exec', 'UpdateAppointment', { id, set: { location: 'Sur place' }, remove: [CONTACT] });
    const a = (await call('run', 'Appointment', { id })).appointment;
    assert.deepEqual([a.location, a.participants.length], ['Sur place', 0]);
    await call('exec', 'SetAppointmentStatus', { id, status: 'done' });
    assert.equal((await call('run', 'Appointment', { id })).appointment.status, 'done');
    await assert.rejects(call('exec', 'ResendParticipant', { appointmentId: id, contactId: CONTACT }), /appointment_participant_not_found/);
  });

  await t.test('bell: list, unread count, mark one, mark all', async () => {
    const n1 = await insertNotification({ organization_id: ORG, user_id: STAFF, kind: 'lease_grace', title: 'Bail 7', link: '/baux/x', dedupe_key: `t1:${id}` });
    await insertNotification({ organization_id: ORG, user_id: STAFF, kind: 'lease_grace', title: 'Bail 8', link: '/baux/y', dedupe_key: `t2:${id}` });
    assert.equal((await call('run', 'Notifications', {})).notifications_aggregate.aggregate.count, 2);
    await call('exec', 'MarkNotificationRead', { id: n1!.id, now: new Date().toISOString() });
    assert.equal((await call('run', 'Notifications', {})).notifications_aggregate.aggregate.count, 1);
    assert.equal((await call('exec', 'MarkAllNotificationsRead', { now: new Date().toISOString() })).update_notifications.affected_rows, 1);
  });
});
