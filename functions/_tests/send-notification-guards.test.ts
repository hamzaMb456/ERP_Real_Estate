import { describe, expect, it } from 'vitest';
import { handleNotificationEmail } from '../send-notification-email';
import { fakeMailer } from './fakes';

const REMINDER = {
  id: 'n1',
  user_id: 'u1',
  kind: 'appointment_reminder',
  title: 'Visite Lot 4',
  body: null,
  link: null,
  appointment_id: 'a1',
  emailed_at: null,
};
const ENV = { NHOST_WEBHOOK_SECRET: 'sec' };
const HEADERS = { 'x-nhost-webhook-secret': 'sec' };
const eventFor = (row: object) => ({
  event: { op: 'INSERT', data: { old: null, new: row } },
  table: { schema: 'public', name: 'notifications' },
  trigger: { name: 't' },
});

type Options = {
  row?: Record<string, unknown>;
  appointment?: { status: string; starts_at: string } | null;
  failWrites?: boolean;
};

function fakeHasura(opts: Options = {}) {
  const writes: Array<Record<string, unknown>> = [];
  const queries: string[] = [];
  const appointment = opts.appointment === undefined ? { status: 'planned', starts_at: 'x' } : opts.appointment;
  return {
    writes,
    queries,
    client: {
      async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
        queries.push(query);
        if (query.includes('update_notifications_by_pk')) {
          if (opts.failWrites) throw new Error('hasura down');
          writes.push(variables.set as Record<string, unknown>);
          return {} as T;
        }
        if (query.includes('appointments_by_pk')) return { appointments_by_pk: appointment } as T;
        if (query.includes('notifications_by_pk')) return { notifications_by_pk: opts.row ?? REMINDER } as T;
        if (query.includes('staff_members')) return { staff_members: [{ email: 'staff@x.tn' }] } as T;
        throw new Error('unexpected query');
      },
    },
  };
}

const run = (hasura: ReturnType<typeof fakeHasura>, mailer: ReturnType<typeof fakeMailer>) =>
  handleNotificationEmail({ headers: HEADERS, body: eventFor(REMINDER), env: ENV }, { client: hasura.client, mailer });

describe('reminder for an appointment that is no longer planned', () => {
  it('sends nothing for a cancelled appointment and records why', async () => {
    const hasura = fakeHasura({ appointment: { status: 'cancelled', starts_at: 'x' } });
    const mailer = fakeMailer();
    const out = await run(hasura, mailer);
    expect(out.status).toBe(200);
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.writes).toEqual([{ email_error: 'rendez-vous annule ou deplace' }]);
  });

  it('sends nothing when the appointment no longer exists', async () => {
    const hasura = fakeHasura({ appointment: null });
    const mailer = fakeMailer();
    const out = await run(hasura, mailer);
    expect(out.status).toBe(200);
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.writes).toEqual([{ email_error: 'rendez-vous annule ou deplace' }]);
  });

  it('still sends the reminder of a planned appointment', async () => {
    const hasura = fakeHasura();
    const mailer = fakeMailer();
    const out = await run(hasura, mailer);
    expect(out.status).toBe(200);
    expect(mailer.send).toHaveBeenCalledOnce();
    expect(hasura.writes[0]).toHaveProperty('emailed_at');
  });

  it('makes no appointment query for a notification of another kind', async () => {
    const row = { ...REMINDER, kind: 'lease_expired', appointment_id: null };
    const hasura = fakeHasura({ row });
    const mailer = fakeMailer();
    await run(hasura, mailer);
    expect(mailer.send).toHaveBeenCalledOnce();
    expect(hasura.queries.some((q) => q.includes('appointments_by_pk'))).toBe(false);
  });
});

describe('a failing write after a successful send', () => {
  it('returns 200 and counts the write error instead of a 500 that would resend the mail', async () => {
    const hasura = fakeHasura({ failWrites: true });
    const mailer = fakeMailer();
    const out = await run(hasura, mailer);
    expect(out.status).toBe(200);
    expect(mailer.send).toHaveBeenCalledOnce();
    expect(out.body).toMatchObject({ sent: true, writeErrors: 1 });
  });
});
