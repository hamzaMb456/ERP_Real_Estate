// E-mails driven by table changes (DynamoDB Streams).
// The decisions and the French templates are the ones functions/ already uses; only the data
// access moved from Postgres to DynamoDB. A change record is turned into the RowChangeEvent shape
// those decision functions expect.
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { decideAppointmentAction, decideParticipantAction } from '../../../../functions/_lib/appointment-decisions.ts';
import type { RowChangeEvent } from '../../../../functions/_lib/event.ts';
import { appointmentMail, notificationMail, staffInvitationMail } from '../../../../functions/_lib/mail-templates.ts';
import type { Item } from './db.ts';
import { batchGet, doc, getItem, queryAll, table } from './db.ts';
import { signToken } from './staff-invitations.ts';

const MAX_ERROR_LENGTH = 500;
const NO_EMAIL_ERROR = 'destinataire sans e-mail';
const STALE_REMINDER_ERROR = 'rendez-vous annule ou deplace';
const TABLE_NAMES: Record<string, string> = {
  AppointmentParticipant: 'appointment_participants',
  Appointment: 'appointments',
  Notification: 'notifications',
};

export interface Mailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

export interface MailDeps {
  /** Lazy: built only when a mail really goes out (SMTP config comes from Secrets Manager). */
  mailer: () => Mailer;
  appUrl?: string;
  /** Signs the links in staff invitations. Comes from the same secret as the SMTP settings. */
  inviteSecret?: string;
}

export interface ChangeRecord {
  model: string;
  op: 'INSERT' | 'MODIFY' | 'REMOVE';
  old?: Item;
  new?: Item;
}

interface StreamRecord {
  eventName?: string;
  eventSourceARN?: string;
  dynamodb?: { OldImage?: Record<string, unknown>; NewImage?: Record<string, unknown> };
}

type MailKind = 'invitation' | 'update' | 'cancellation';
interface Participant { contact_id: string; email_status: string; email: string | null }
interface Appointment extends Item { participants: Participant[] }

/** The table name (Model-apiId-NONE) is in the stream ARN: arn:...:table/<name>/stream/<label>. */
export function fromStreamRecord(record: StreamRecord): ChangeRecord {
  const tableName = record.eventSourceARN?.split(':table/')[1]?.split('/')[0] ?? '';
  const image = (raw?: Record<string, unknown>) => (raw ? unmarshall(raw as never) : undefined);
  return {
    model: tableName.split('-')[0],
    op: record.eventName as ChangeRecord['op'],
    old: image(record.dynamodb?.OldImage),
    new: image(record.dynamodb?.NewImage),
  };
}

function asRowChangeEvent(change: ChangeRecord): RowChangeEvent {
  const op = change.op === 'MODIFY' ? 'UPDATE' : change.op === 'REMOVE' ? 'DELETE' : 'INSERT';
  return {
    table: { name: TABLE_NAMES[change.model] ?? change.model },
    event: { op, data: { old: change.old ?? null, new: change.new ?? null } },
  } as unknown as RowChangeEvent;
}

async function loadAppointment(id: string): Promise<Appointment | null> {
  const appointment = await getItem('Appointment', { id });
  if (!appointment) return null;
  const rows = await queryAll('AppointmentParticipant', { key: 'appointment_id', value: id });
  const contacts = new Map((await batchGet('Contact', rows.map((r) => r.contact_id))).map((c) => [c.id as string, c]));
  return {
    ...appointment,
    participants: rows.map((r) => ({
      contact_id: r.contact_id,
      email_status: r.email_status,
      email: (contacts.get(r.contact_id)?.email as string | undefined)?.trim() || null,
    })),
  };
}

async function markParticipant(appointmentId: string, contactId: string, status: 'sent' | 'failed' | 'skipped', error: string | null): Promise<void> {
  await doc.send(new UpdateCommand({
    TableName: table('AppointmentParticipant'),
    Key: { appointment_id: appointmentId, contact_id: contactId },
    UpdateExpression: 'SET email_status = :s, email_error = :e, updated_at = :now',
    ConditionExpression: 'attribute_exists(appointment_id)',
    ExpressionAttributeValues: { ':s': status, ':e': error, ':now': new Date().toISOString() },
  }));
}

const logWriteError = (...ids: string[]) => (err: Error): void => {
  console.error(`mailer: status write failed after send (${ids.join('/')}):`, err.message);
};

/** One mail; the outcome lands on the participant. Neither an SMTP error nor a failed write throws. */
async function sendToParticipant(deps: MailDeps, appointment: Appointment, participant: Participant, kind: MailKind): Promise<'sent' | 'failed'> {
  const mail = appointmentMail(kind, {
    title: appointment.title, kind: appointment.kind, startsAt: appointment.starts_at, endsAt: appointment.ends_at, location: appointment.location,
  });
  try {
    await deps.mailer().send({ to: participant.email!, ...mail });
  } catch (err) {
    await markParticipant(appointment.id, participant.contact_id, 'failed', ((err as Error).message ?? 'erreur d\'envoi').slice(0, MAX_ERROR_LENGTH))
      .catch(logWriteError(appointment.id, participant.contact_id));
    return 'failed';
  }
  // The mail is out: a failed write is logged, never thrown (a retry would mail the person again).
  await markParticipant(appointment.id, participant.contact_id, 'sent', null).catch(logWriteError(appointment.id, participant.contact_id));
  return 'sent';
}

/** Invitation (insert) or resend (back to pending) for one participant. */
async function onParticipant(change: ChangeRecord, deps: MailDeps): Promise<string> {
  const event = asRowChangeEvent(change);
  if (decideParticipantAction(event) === 'none' || !change.new) return 'none';
  const appointment = await loadAppointment(change.new.appointment_id);
  const participant = appointment?.participants.find((p) => p.contact_id === change.new!.contact_id);
  // The stored status wins over the event: a replayed record sees 'sent' and sends nothing.
  if (!appointment || !participant || participant.email_status === 'sent') return 'none';
  const action = decideParticipantAction(event, {
    planned: appointment.status === 'planned', notifyByEmail: appointment.notify_by_email, email: participant.email,
  });
  if (action !== 'invite' || !participant.email) {
    await markParticipant(appointment.id, participant.contact_id, 'skipped', null);
    return 'skip';
  }
  return sendToParticipant(deps, appointment, participant, 'invitation');
}

/** Cancellation or update mail to everyone reachable, or invitations once e-mails are switched on. */
async function onAppointment(change: ChangeRecord, deps: MailDeps): Promise<string> {
  const event = asRowChangeEvent(change);
  const action = decideAppointmentAction(event);
  if (action === 'none' || !change.new) return 'none';
  const appointment = await loadAppointment(change.new.id);
  if (!appointment || !appointment.notify_by_email) return 'none';
  if (action === 'invite_all' && appointment.status !== 'planned') return 'none';

  const wasNotifying = change.old?.notify_by_email === true && appointment.notify_by_email;
  const targets = action === 'invite_all'
    ? appointment.participants.filter((p) => p.email_status !== 'sent')
    : appointment.participants.filter((p) => p.email_status !== 'skipped' || (wasNotifying && p.email !== null));
  const kind: MailKind = action === 'cancel' ? 'cancellation' : action === 'update' ? 'update' : 'invitation';
  let sent = 0;
  for (const p of targets) {
    if (!p.email) {
      if (p.email_status !== 'skipped') await markParticipant(appointment.id, p.contact_id, 'skipped', null);
      continue;
    }
    if ((await sendToParticipant(deps, appointment, p, kind)) === 'sent') sent += 1;
  }
  return `${action}:${sent}`;
}

async function markNotification(id: string, set: { emailed_at?: string; email_error: string | null }): Promise<void> {
  const names = Object.keys(set);
  await doc.send(new UpdateCommand({
    TableName: table('Notification'),
    Key: { id },
    UpdateExpression: `SET ${names.map((n) => `${n} = :${n}`).join(', ')}`,
    ConditionExpression: 'attribute_exists(id)',
    ExpressionAttributeValues: Object.fromEntries(names.map((n) => [`:${n}`, set[n as keyof typeof set]])),
  }));
}

/** A new bell notification is also mailed to its staff recipient. */
async function onNotification(change: ChangeRecord, deps: MailDeps): Promise<string> {
  if (change.op !== 'INSERT' || !change.new) return 'none';
  const row = await getItem('Notification', { id: change.new.id });
  if (!row || row.emailed_at) return 'none';
  if (row.kind === 'appointment_reminder' && row.appointment_id) {
    const appointment = await getItem('Appointment', { id: row.appointment_id });
    if (appointment?.status !== 'planned') {
      await markNotification(row.id, { email_error: STALE_REMINDER_ERROR });
      return 'stale';
    }
  }
  const to = ((await getItem('StaffMember', { id: row.user_id }))?.email as string | undefined)?.trim();
  if (!to) {
    await markNotification(row.id, { email_error: NO_EMAIL_ERROR });
    return 'no_email';
  }
  try {
    await deps.mailer().send({ to, ...notificationMail(row as never, deps.appUrl) });
  } catch (err) {
    await markNotification(row.id, { email_error: ((err as Error).message ?? 'erreur d\'envoi').slice(0, MAX_ERROR_LENGTH) });
    return 'failed';
  }
  await markNotification(row.id, { emailed_at: new Date().toISOString(), email_error: null }).catch(logWriteError(row.id));
  return 'sent';
}

/** A new staff invitation: one mail with the signed link. Not for changes, and not for a link already used or revoked. */
async function onStaffInvitation(change: ChangeRecord, deps: MailDeps): Promise<string> {
  const row = change.new;
  if (change.op !== 'INSERT' || !row || row.used_at || row.revoked_at) return 'none';
  // Missing settings fail loudly (the stream retries the batch) instead of dropping an invitation.
  if (!deps.inviteSecret) throw new Error('mailer not configured: INVITE_SECRET missing');
  if (!deps.appUrl) throw new Error('mailer not configured: APP_URL missing');
  const link = `${deps.appUrl.replace(/\/+$/, '')}/erp/invitation?token=${signToken(deps.inviteSecret, row.id, row.expires_at)}`;
  const mail = staffInvitationMail(row.display_name, link);
  await deps.mailer().send({ to: row.email, subject: mail.subject, text: mail.text });
  return 'sent';
}

export async function handleChange(change: ChangeRecord, deps: MailDeps): Promise<string> {
  if (change.model === 'StaffInvitation') return onStaffInvitation(change, deps);
  if (change.model === 'AppointmentParticipant') return onParticipant(change, deps);
  if (change.model === 'Appointment') return onAppointment(change, deps);
  if (change.model === 'Notification') return onNotification(change, deps);
  return 'none';
}
