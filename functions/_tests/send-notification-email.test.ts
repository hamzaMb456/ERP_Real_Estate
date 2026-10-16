import { describe, expect, it, vi } from 'vitest';
import handler, { handleNotificationEmail } from '../send-notification-email';
import { fakeMailer } from './fakes';

type Row = {
  id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  emailed_at: string | null;
};

const ROW: Row = {
  id: 'n1',
  user_id: 'u1',
  kind: 'lease_expired',
  title: 'Bail 12',
  body: 'Fin.',
  link: '/baux/x',
  emailed_at: null,
};
const ENV = { NHOST_WEBHOOK_SECRET: 'sec', APP_URL: 'https://erp.tn' };
const HEADERS = { 'x-nhost-webhook-secret': 'sec' };
const eventFor = (row: object) => ({
  event: { op: 'INSERT', data: { old: null, new: row } },
  table: { schema: 'public', name: 'notifications' },
  trigger: { name: 't' },
});

function fakeHasura(opts: { row?: Row | null; email?: string | null } = {}) {
  const writes: Array<Record<string, unknown>> = [];
  const queries: string[] = [];
  const row = opts.row === undefined ? ROW : opts.row;
  return {
    writes,
    queries,
    client: {
      async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
        queries.push(query);
        if (query.includes('update_notifications_by_pk')) {
          writes.push(variables.set as Record<string, unknown>);
          return {} as T;
        }
        if (query.includes('notifications_by_pk')) return { notifications_by_pk: row } as T;
        if (query.includes('staff_members')) {
          return { staff_members: opts.email === null ? [] : [{ email: opts.email ?? 'staff@x.tn' }] } as T;
        }
        throw new Error('unexpected query');
      },
    },
  };
}

type Mailer = ReturnType<typeof fakeMailer>;

const run = (hasura: ReturnType<typeof fakeHasura>, mailer: Mailer, headers: Record<string, string> = HEADERS) =>
  handleNotificationEmail({ headers, body: eventFor(ROW), env: ENV }, { client: hasura.client, mailer });

describe('handleNotificationEmail', () => {
  it('returns 401 without a valid secret and sends nothing', async () => {
    const hasura = fakeHasura();
    const mailer = fakeMailer();
    const out = await run(hasura, mailer, { 'x-nhost-webhook-secret': 'bad' });
    expect(out.status).toBe(401);
    expect(hasura.queries).toHaveLength(0);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('skips a notification that already has emailed_at', async () => {
    const hasura = fakeHasura({ row: { ...ROW, emailed_at: '2026-10-16T08:00:00Z' } });
    const mailer = fakeMailer();
    const out = await run(hasura, mailer);
    expect(out.status).toBe(200);
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.writes).toHaveLength(0);
  });

  it('writes emailed_at after a successful send, with a French subject containing the title', async () => {
    const hasura = fakeHasura();
    const mailer = fakeMailer();
    const out = await run(hasura, mailer);
    expect(out.status).toBe(200);
    expect(mailer.send).toHaveBeenCalledOnce();
    const message = mailer.send.mock.calls[0]![0];
    expect(message.to).toBe('staff@x.tn');
    expect(message.subject).toContain('Bail 12');
    expect(message.subject).toContain('Bail expiré');
    expect(message.text).toContain('https://erp.tn/baux/x');
    expect(hasura.writes).toHaveLength(1);
    expect(hasura.writes[0]).toHaveProperty('emailed_at');
    expect(hasura.writes[0]?.email_error).toBeNull();
  });

  it('writes email_error (at most 500 characters) and still returns 200 when the send fails', async () => {
    const hasura = fakeHasura();
    const mailer = fakeMailer(async () => {
      throw new Error('x'.repeat(800));
    });
    const out = await run(hasura, mailer);
    expect(out.status).toBe(200);
    const written = hasura.writes[0] as { email_error: string };
    expect(written.email_error).toHaveLength(500);
    expect(hasura.writes[0]).not.toHaveProperty('emailed_at');
  });

  it('records a recipient without an e-mail address and sends nothing', async () => {
    const hasura = fakeHasura({ email: null });
    const mailer = fakeMailer();
    const out = await run(hasura, mailer);
    expect(out.status).toBe(200);
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.writes[0]).toEqual({ email_error: 'destinataire sans e-mail' });
  });

  it('ignores an event without a new row', async () => {
    const hasura = fakeHasura();
    const mailer = fakeMailer();
    const body = { event: { op: 'DELETE', data: { old: ROW, new: null } } };
    const out = await handleNotificationEmail({ headers: HEADERS, body, env: ENV }, { client: hasura.client, mailer });
    expect(out.status).toBe(200);
    expect(hasura.queries).toHaveLength(0);
  });

  it('names the missing SMTP variable with status 500 (no value)', async () => {
    const hasura = fakeHasura();
    const env = { ...ENV, SMTP_HOST: 'h', SMTP_PORT: '587', SMTP_USER: 'u', SMTP_FROM: 'f' };
    const out = await handleNotificationEmail({ headers: HEADERS, body: eventFor(ROW), env }, { client: hasura.client });
    expect(out.status).toBe(500);
    expect(JSON.stringify(out.body)).toContain('SMTP_PASSWORD');
  });
});

describe('default export (Express adapter)', () => {
  it('answers 401 through res when the secret is wrong', async () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await handler({ headers: {}, body: eventFor(ROW) }, { status });
    expect(status).toHaveBeenCalledWith(401);
  });
});
