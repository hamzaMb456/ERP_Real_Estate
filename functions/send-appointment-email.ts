import {
  emailOf,
  loadAppointment,
  markParticipant,
  sendToParticipant,
  type MailKind,
  type Tally,
} from './_lib/appointment-data';
import { decideAppointmentAction, decideParticipantAction } from './_lib/appointment-decisions';
import { parseEvent, type HasuraEvent } from './_lib/event';
import type { HasuraClient } from './_lib/hasura';
import { respond, type FnRequest, type FnResponse } from './_lib/http';
import type { Mailer } from './_lib/mailer';
import { resolveClient, type CoreResult, type Env } from './_lib/runtime';
import { resolveMailer } from './_lib/smtp-env';
import { isAuthorizedWebhook } from './_lib/webhook';

type Input = { headers: FnRequest['headers']; body: unknown; env: Env };
type Deps = { client?: HasuraClient; mailer?: Mailer };

const done = (body: Record<string, unknown>): CoreResult => ({ status: 200, body });
const emptyTally = (): Tally => ({ sent: 0, failed: 0, skipped: 0 });

/** Invitation, or Renvoyer, for the single participant a row event is about. */
async function handleParticipant(event: HasuraEvent, input: Input, deps: Deps, client: HasuraClient): Promise<CoreResult> {
  const row = event.event.data.new ?? {};
  if (decideParticipantAction(event) === 'none') return done({ action: 'none' });
  const appointment = await loadAppointment(client, String(row.appointment_id));
  const participant = appointment?.participants.find((p) => p.contact_id === row.contact_id);
  // The stored status wins over the event: a retried insert sees 'sent' and sends nothing.
  if (!appointment || !participant || participant.email_status === 'sent') return done({ action: 'none' });

  const email = emailOf(participant);
  const action = decideParticipantAction(event, {
    planned: appointment.status === 'planned',
    notifyByEmail: appointment.notify_by_email,
    email,
  });
  if (action !== 'invite' || !email) {
    await markParticipant(client, appointment.id, participant.contact_id, { email_status: 'skipped', email_error: null });
    return done({ action: 'skip' });
  }
  const mailer = resolveMailer(input.env, deps.mailer);
  if (!mailer.ok) return mailer.result;
  const tally = emptyTally();
  await sendToParticipant({ client, mailer: mailer.value }, appointment, participant, email, 'invitation', tally);
  return done({ action: 'invite', ...tally });
}

/** Cancellation or update mail for every participant that can be reached. */
async function handleAppointment(event: HasuraEvent, input: Input, deps: Deps, client: HasuraClient): Promise<CoreResult> {
  const action = decideAppointmentAction(event);
  if (action === 'none') return done({ action: 'none' });
  const appointment = await loadAppointment(client, String(event.event.data.new?.id));
  if (!appointment || !appointment.notify_by_email) return done({ action: 'none' });

  const targets = appointment.participants.filter((p) => p.email_status !== 'skipped');
  const reachable = targets.filter((p) => emailOf(p) !== null);
  const mailer = reachable.length > 0 ? resolveMailer(input.env, deps.mailer) : null;
  if (mailer && !mailer.ok) return mailer.result;

  const tally = emptyTally();
  for (const participant of targets.filter((p) => emailOf(p) === null)) {
    tally.skipped += 1;
    await markParticipant(client, appointment.id, participant.contact_id, { email_status: 'skipped', email_error: null });
  }
  const kind: MailKind = action === 'cancel' ? 'cancellation' : 'update';
  for (const participant of reachable) {
    await sendToParticipant({ client, mailer: mailer!.value }, appointment, participant, emailOf(participant)!, kind, tally);
  }
  return done({ action, ...tally });
}

export async function handleAppointmentEmail(input: Input, deps: Deps = {}): Promise<CoreResult> {
  if (!isAuthorizedWebhook(input.headers, input.env.NHOST_WEBHOOK_SECRET)) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const event = parseEvent(input.body);
  if (!event) return { status: 400, body: { error: 'invalid_event' } };
  const client = resolveClient(input.env, deps.client);
  if (!client.ok) return client.result;
  if (event.table.name === 'appointment_participants') return handleParticipant(event, input, deps, client.value);
  if (event.table.name === 'appointments') return handleAppointment(event, input, deps, client.value);
  return done({ action: 'none' });
}

export default async function handler(req: FnRequest, res: FnResponse): Promise<void> {
  await respond(res, () => handleAppointmentEmail({ headers: req.headers, body: req.body, env: process.env }));
}
