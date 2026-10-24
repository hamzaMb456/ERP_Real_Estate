// Integration: appointments + daily notifications against the dev tables on Floci (fresh org per run).
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from './test-env.ts';

const ready = await useDevTables();
const { doc, table, getItem } = await import('./db.ts');
const { saveAppointment, deleteAppointment } = await import('./appointments.ts');
const { generateDailyNotifications, markNotificationsRead, notificationId, reminderDedupeKey } = await import('./notifications.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const [ADMIN, MANAGER, STRANGER] = [randomUUID(), randomUUID(), randomUUID()];
const manager = { role: 'manager', userId: MANAGER, orgId: ORG };
const CONTACT = randomUUID();
const LEASE = randomUUID();

const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: 'x', updated_at: 'x', ...item } }));
const code = async (p: Promise<unknown>): Promise<string> => {
  try { await p; } catch (err) { return (err as { code?: string }).code ?? (err as Error).message; }
  return 'no error';
};
const appointment = (over: Record<string, unknown> = {}) => ({
  kind: 'viewing', title: 'Visite A1', starts_at: '2026-05-11T09:00:00Z', ends_at: '2026-05-11T10:00:00Z',
  participants: [{ contact_id: CONTACT, role: 'prospect' }], ...over,
});

before(async () => {
  if (!ready) return;
  await put('StaffMember', { id: ADMIN, organization_id: ORG, display_name: 'Admin', role: 'org_admin' });
  await put('StaffMember', { id: MANAGER, organization_id: ORG, display_name: 'Manager', role: 'manager' });
  await put('StaffMember', { id: STRANGER, organization_id: randomUUID(), display_name: 'Other org', role: 'manager' });
  await put('Contact', { id: CONTACT, organization_id: ORG, full_name: 'Prospect', roles: [] });
  await put('Lease', {
    id: LEASE, organization_id: ORG, number: 4, status: 'active', start_date: '2025-06-01', end_date: '2026-06-30',
    payment_day: 1, deposit_amount: 0, rents: [], terms: [], signed_at: '2025-06-01', registered_at: '2025-06-10',
  });
});

test('appointments and daily notifications', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  await t.test('assignee must be staff of the organization', async () => {
    assert.equal(await code(saveAppointment(manager, appointment({ assigned_user_id: STRANGER }))), 'appointment_staff_invalid');
    assert.equal(await code(saveAppointment(manager, appointment({ ends_at: '2026-05-11T09:00:00Z' }))), 'appointments_dates_check');
  });

  const appt = await saveAppointment(manager, appointment({ assigned_user_id: MANAGER }));

  await t.test('participants start pending', async () => {
    const p = await getItem('AppointmentParticipant', { appointment_id: appt.id, contact_id: CONTACT });
    assert.equal(p?.email_status, 'pending');
  });

  await t.test('daily run: lease ending soon for all staff, reminder for the assignee only, idempotent', async () => {
    const first = (await generateDailyNotifications('2026-05-10')).filter((n) => n.organization_id === ORG);
    const kinds = first.map((n) => `${n.kind}:${n.user_id === MANAGER ? 'M' : 'A'}`).sort();
    assert.deepEqual(kinds, ['appointment_reminder:M', 'lease_ending_soon:A', 'lease_ending_soon:M']);
    assert.ok(first.every((n) => n.expires_at > Date.now() / 1000 && n.expires_at < Date.now() / 1000 + 91 * 86_400));
    const second = (await generateDailyNotifications('2026-05-10')).filter((n) => n.organization_id === ORG);
    assert.equal(second.length, 0);
    assert.ok((await getItem('Appointment', { id: appt.id }))?.reminder_sent_at);
  });

  await t.test('moving the appointment to another day drops its reminder', async () => {
    const reminderId = notificationId(MANAGER, reminderDedupeKey(appt.id, '2026-05-11'));
    assert.ok(await getItem('Notification', { id: reminderId }));
    await saveAppointment(manager, appointment({ id: appt.id, assigned_user_id: MANAGER, starts_at: '2026-05-12T09:00:00Z', ends_at: '2026-05-12T10:00:00Z' }));
    assert.equal(await getItem('Notification', { id: reminderId }), undefined);
  });

  await t.test('bell: mark own notifications read', async () => {
    const marked = await markNotificationsRead(manager);
    assert.ok(marked >= 1);
    assert.equal(await markNotificationsRead(manager), 0);
  });

  await t.test('delete removes participants', async () => {
    await deleteAppointment(manager, appt.id);
    assert.equal(await getItem('AppointmentParticipant', { appointment_id: appt.id, contact_id: CONTACT }), undefined);
  });
});
