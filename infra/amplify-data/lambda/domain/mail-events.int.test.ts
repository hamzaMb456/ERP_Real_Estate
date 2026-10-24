// Integration: change-driven e-mails against the dev tables on Floci, with a fake mailer (nothing is sent).
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from './test-env.ts';

const ready = await useDevTables();
const { doc, table, getItem } = await import('./db.ts');
const { fromStreamRecord, handleChange } = await import('./mail-events.ts');
const { insertNotification } = await import('./notifications.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
const { marshall } = await import('@aws-sdk/util-dynamodb');

const ORG = randomUUID();
const STAFF = randomUUID();
const APPT = randomUUID();
const [WITH_EMAIL, NO_EMAIL] = [randomUUID(), randomUUID()];
const sent: { to: string; subject: string }[] = [];
const deps = { mailer: () => ({ send: async (m: { to: string; subject: string; text: string }) => { sent.push(m); } }), appUrl: 'http://localhost:3000' };

const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: 'x', updated_at: 'x', ...item } }));
const appointment = { id: APPT, organization_id: ORG, kind: 'viewing', title: 'Visite', starts_at: '2026-05-11T09:00:00Z', ends_at: '2026-05-11T10:00:00Z', status: 'planned', notify_by_email: true, location: 'Tunis' };
const participant = (contactId: string, status = 'pending') => ({ appointment_id: APPT, contact_id: contactId, organization_id: ORG, role: 'prospect', email_status: status });

before(async () => {
  if (!ready) return;
  await put('StaffMember', { id: STAFF, organization_id: ORG, display_name: 'Staff', email: 'staff@example.test', role: 'manager' });
  await put('Contact', { id: WITH_EMAIL, organization_id: ORG, full_name: 'Has mail', email: 'client@example.test' });
  await put('Contact', { id: NO_EMAIL, organization_id: ORG, full_name: 'No mail' });
  await put('Appointment', appointment);
  await put('AppointmentParticipant', participant(WITH_EMAIL));
  await put('AppointmentParticipant', participant(NO_EMAIL));
});

test('change-driven e-mails', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  await t.test('stream record decoding: model from the table name, images unmarshalled', () => {
    const change = fromStreamRecord({
      eventName: 'INSERT',
      eventSourceARN: `arn:aws:dynamodb:us-east-1:000000000000:table/${table('AppointmentParticipant')}/stream/2026`,
      dynamodb: { NewImage: marshall(participant(WITH_EMAIL)) as Record<string, unknown> },
    });
    assert.equal(change.model, 'AppointmentParticipant');
    assert.equal(change.new?.contact_id, WITH_EMAIL);
  });

  await t.test('invitation to a contact with an e-mail, skip without one, no resend', async () => {
    assert.equal(await handleChange({ model: 'AppointmentParticipant', op: 'INSERT', new: participant(WITH_EMAIL) }, deps), 'sent');
    assert.equal(sent.at(-1)?.to, 'client@example.test');
    assert.equal((await getItem('AppointmentParticipant', { appointment_id: APPT, contact_id: WITH_EMAIL }))?.email_status, 'sent');
    assert.equal(await handleChange({ model: 'AppointmentParticipant', op: 'INSERT', new: participant(NO_EMAIL) }, deps), 'skip');
    assert.equal(await handleChange({ model: 'AppointmentParticipant', op: 'INSERT', new: participant(WITH_EMAIL) }, deps), 'none');
  });

  await t.test('cancellation goes to everyone who was mailed', async () => {
    const before = sent.length;
    const cancelled = { ...appointment, status: 'cancelled' };
    await put('Appointment', cancelled);
    assert.equal(await handleChange({ model: 'Appointment', op: 'MODIFY', old: appointment, new: cancelled }, deps), 'cancel:1');
    assert.equal(sent.length, before + 1);
  });

  await t.test('a new notification is mailed to its staff recipient', async () => {
    const n = await insertNotification({ organization_id: ORG, user_id: STAFF, kind: 'lease_grace', title: 'Bail 9', link: '/baux/x', dedupe_key: `test:${randomUUID()}` });
    assert.equal(await handleChange({ model: 'Notification', op: 'INSERT', new: n! }, deps), 'sent');
    assert.equal(sent.at(-1)?.to, 'staff@example.test');
    assert.ok((await getItem('Notification', { id: n!.id }))?.emailed_at);
  });
});
