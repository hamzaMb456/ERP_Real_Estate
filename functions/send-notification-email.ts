import { parseEvent } from './_lib/event';
import type { HasuraClient } from './_lib/hasura';
import { respond, type FnRequest, type FnResponse } from './_lib/http';
import type { Mailer } from './_lib/mailer';
import { notificationMail } from './_lib/mail-templates';
import { resolveClient, type CoreResult, type Env } from './_lib/runtime';
import { resolveMailer } from './_lib/smtp-env';
import { isAuthorizedWebhook } from './_lib/webhook';

const MAX_ERROR_LENGTH = 500;
const NO_EMAIL_ERROR = 'destinataire sans e-mail';

type NotificationRow = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  emailed_at: string | null;
};

const GET_NOTIFICATION = `query GetNotification($id: uuid!) {
  notifications_by_pk(id: $id) { id user_id kind title body link emailed_at }
}`;
const GET_RECIPIENT = `query GetRecipient($id: uuid!) {
  staff_members(where: { user_id: { _eq: $id } }, limit: 1) { email }
}`;
const MARK_NOTIFICATION = `mutation MarkNotification($id: uuid!, $set: notifications_set_input!) {
  update_notifications_by_pk(pk_columns: { id: $id }, _set: $set) { id }
}`;

async function loadRecipient(client: HasuraClient, userId: string): Promise<string | null> {
  const data = await client.request<{ staff_members: Array<{ email: string | null }> }>(GET_RECIPIENT, { id: userId });
  const email = data.staff_members[0]?.email?.trim();
  return email ? email : null;
}

async function markNotification(client: HasuraClient, id: string, set: Record<string, unknown>): Promise<void> {
  await client.request(MARK_NOTIFICATION, { id, set });
}

export async function handleNotificationEmail(
  input: { headers: FnRequest['headers']; body: unknown; env: Env },
  deps: { client?: HasuraClient; mailer?: Mailer } = {},
): Promise<CoreResult> {
  if (!isAuthorizedWebhook(input.headers, input.env.NHOST_WEBHOOK_SECRET)) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const id = parseEvent(input.body)?.event.data.new?.id;
  if (typeof id !== 'string') return { status: 200, body: { skipped: 'no_row' } };

  const client = resolveClient(input.env, deps.client);
  if (!client.ok) return client.result;
  const hasura = client.value;

  const found = await hasura.request<{ notifications_by_pk: NotificationRow | null }>(GET_NOTIFICATION, { id });
  const row = found.notifications_by_pk;
  if (!row || row.emailed_at) return { status: 200, body: { skipped: 'already_emailed' } };

  const to = await loadRecipient(hasura, row.user_id);
  if (!to) {
    await markNotification(hasura, row.id, { email_error: NO_EMAIL_ERROR });
    return { status: 200, body: { skipped: 'no_recipient_email' } };
  }
  const mailer = resolveMailer(input.env, deps.mailer);
  if (!mailer.ok) return mailer.result;

  try {
    await mailer.value.send({ to, ...notificationMail(row, input.env.APP_URL) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'erreur d\'envoi';
    await markNotification(hasura, row.id, { email_error: message.slice(0, MAX_ERROR_LENGTH) });
    return { status: 200, body: { sent: false } };
  }
  await markNotification(hasura, row.id, { emailed_at: new Date().toISOString(), email_error: null });
  return { status: 200, body: { sent: true } };
}

export default async function handler(req: FnRequest, res: FnResponse): Promise<void> {
  await respond(res, () => handleNotificationEmail({ headers: req.headers, body: req.body, env: process.env }));
}
