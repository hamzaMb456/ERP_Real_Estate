import { freshToken } from '@/lib/auth/session';

/**
 * One manager action on a staff account (create, resend, disable, resetmfa), sent to the server route with the signed-in
 * manager's token. The route checks the role again; a refusal throws an Error whose message is the route error code
 * (for example "email_taken"), which the shared error messages know how to word.
 */
export async function staffAction<T = { ok: true }>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const token = await freshToken();
  const response = await fetch('/api/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...body }),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'server-error');
  return data;
}
