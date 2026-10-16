import type { HasuraClient } from './hasura';
import type { Mailer } from './mailer';
import { appointmentMail } from './mail-templates';

export type Participant = {
  contact_id: string;
  email_status: string;
  contact: { email: string | null } | null;
};

export type Appointment = {
  id: string;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  status: string;
  notify_by_email: boolean;
  participants: Participant[];
};

export type MailKind = 'invitation' | 'update' | 'cancellation';
export type Tally = { sent: number; failed: number; skipped: number; writeErrors: number };

const GET_APPOINTMENT = `query GetAppointment($id: uuid!) {
  appointments_by_pk(id: $id) {
    id title kind starts_at ends_at location status notify_by_email
    participants { contact_id email_status contact { email } }
  }
}`;
const MARK_PARTICIPANT = `mutation MarkParticipant($appointmentId: uuid!, $contactId: uuid!, $set: appointment_participants_set_input!) {
  update_appointment_participants_by_pk(pk_columns: { appointment_id: $appointmentId, contact_id: $contactId }, _set: $set) { contact_id }
}`;

export async function loadAppointment(client: HasuraClient, id: string): Promise<Appointment | null> {
  const data = await client.request<{ appointments_by_pk: Appointment | null }>(GET_APPOINTMENT, { id });
  return data.appointments_by_pk;
}

export function emailOf(participant: Participant): string | null {
  const email = participant.contact?.email?.trim();
  return email ? email : null;
}

export async function markParticipant(
  client: HasuraClient,
  appointmentId: string,
  contactId: string,
  set: { email_status: 'sent' | 'failed' | 'skipped'; email_error: string | null },
): Promise<void> {
  await client.request(MARK_PARTICIPANT, { appointmentId, contactId, set });
}

/**
 * Records a result after a mail went out. A write failure is counted, never thrown:
 * a 5xx would make Hasura retry the whole event and mail everyone again.
 */
async function recordOutcome(
  client: HasuraClient,
  appointmentId: string,
  contactId: string,
  set: { email_status: 'sent' | 'failed'; email_error: string | null },
  tally: Tally,
): Promise<void> {
  try {
    await markParticipant(client, appointmentId, contactId, set);
  } catch {
    tally.writeErrors += 1;
  }
}

/** Sends one mail and records the outcome on the participant; neither an SMTP error nor a failed write throws. */
export async function sendToParticipant(
  deps: { client: HasuraClient; mailer: Mailer },
  appointment: Appointment,
  participant: Participant,
  to: string,
  kind: MailKind,
  tally: Tally,
): Promise<void> {
  const mail = appointmentMail(kind, {
    title: appointment.title,
    kind: appointment.kind,
    startsAt: appointment.starts_at,
    endsAt: appointment.ends_at,
    location: appointment.location,
  });
  try {
    await deps.mailer.send({ to, ...mail });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur d\'envoi';
    tally.failed += 1;
    await recordOutcome(
      deps.client,
      appointment.id,
      participant.contact_id,
      { email_status: 'failed', email_error: message.slice(0, 500) },
      tally,
    );
    return;
  }
  tally.sent += 1;
  await recordOutcome(deps.client, appointment.id, participant.contact_id, { email_status: 'sent', email_error: null }, tally);
}
