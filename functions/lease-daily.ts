import { respond, type FnRequest, type FnResponse } from './_lib/http';
import type { HasuraClient } from './_lib/hasura';
import { resolveClient, type CoreResult, type Env } from './_lib/runtime';
import { isAuthorizedWebhook } from './_lib/webhook';

// Both SQL functions return the rows they touched (Hasura tracks only set-returning functions).
const EXPIRE_LEASES = 'mutation ExpireOverdueLeases { expire_overdue_leases { id } }';
const GENERATE_NOTIFICATIONS = 'mutation GenerateDailyNotifications { generate_daily_notifications { id } }';

function toCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export async function runLeaseDaily(client: HasuraClient): Promise<{ expired: number; notified: number }> {
  const expired = await client.request<{ expire_overdue_leases?: unknown }>(EXPIRE_LEASES);
  const notified = await client.request<{ generate_daily_notifications?: unknown }>(GENERATE_NOTIFICATIONS);
  return {
    expired: toCount(expired.expire_overdue_leases),
    notified: toCount(notified.generate_daily_notifications),
  };
}

export async function handleLeaseDaily(input: {
  headers: FnRequest['headers'];
  env: Env;
  client?: HasuraClient;
}): Promise<CoreResult> {
  if (!isAuthorizedWebhook(input.headers, input.env.NHOST_WEBHOOK_SECRET)) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const client = resolveClient(input.env, input.client);
  if (!client.ok) return client.result;
  return { status: 200, body: await runLeaseDaily(client.value) };
}

export default async function handler(req: FnRequest, res: FnResponse): Promise<void> {
  await respond(res, () => handleLeaseDaily({ headers: req.headers, env: process.env }));
}
