import { describe, expect, it } from 'vitest';
import { respond } from '../_lib/http';
import { appointment, appointmentEvent, fakeHasura, part, run } from './appointment-fixtures';
import { fakeMailer } from './fakes';

const base = { id: 'a1', status: 'planned', starts_at: 'a', ends_at: 'b', location: 'Rue 1', notes: null };
const moved = () => appointmentEvent({ ...base, notify_by_email: true }, { ...base, location: 'Rue 2', notify_by_email: true });
const two = () => appointment({ participants: [part('c1', 'c1@x.tn', 'sent'), part('c2', 'c2@x.tn', 'sent')] });

describe('a failing result write after sending', () => {
  it('returns 200 with the write error counted, never a 500 that would resend', async () => {
    const hasura = fakeHasura(two(), { failWriteFor: ['c1'] });
    const mailer = fakeMailer();
    const out = await run(hasura, mailer, moved());
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ action: 'update', sent: 2, failed: 0, writeErrors: 1 });
  });

  it('continues with the next participant after a failed write', async () => {
    const hasura = fakeHasura(two(), { failWriteFor: ['c1'] });
    const mailer = fakeMailer();
    await run(hasura, mailer, moved());
    expect(mailer.send.mock.calls.map((c) => c[0].to)).toEqual(['c1@x.tn', 'c2@x.tn']);
    expect(hasura.writes.map((w) => w.contactId)).toEqual(['c2']);
  });

  it('counts a failed write that follows an SMTP failure too', async () => {
    const hasura = fakeHasura(two(), { failWriteFor: ['c1'] });
    const mailer = fakeMailer(async (m) => {
      if (m.to === 'c1@x.tn') throw new Error('smtp down');
    });
    const out = await run(hasura, mailer, moved());
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ sent: 1, failed: 1, writeErrors: 1 });
  });

  it('returns 200 for a single participant invitation whose write fails', async () => {
    const hasura = fakeHasura(appointment({ participants: [part('c1', 'c1@x.tn', 'pending')] }), { failWriteFor: ['c1'] });
    const mailer = fakeMailer();
    const body = {
      event: { op: 'INSERT', data: { old: null, new: { appointment_id: 'a1', contact_id: 'c1', email_status: 'pending' } } },
      table: { schema: 'public', name: 'appointment_participants' },
      trigger: { name: 't' },
    };
    const out = await run(hasura, mailer, body);
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ action: 'invite', sent: 1, writeErrors: 1 });
  });

  it('counts write errors while inviting everyone', async () => {
    const hasura = fakeHasura(
      appointment({ participants: [part('c1', 'c1@x.tn', 'skipped'), part('c2', 'c2@x.tn', 'skipped')] }),
      { failWriteFor: ['c1'] },
    );
    const mailer = fakeMailer();
    const event = appointmentEvent({ ...base, notify_by_email: false }, { ...base, notify_by_email: true });
    const out = await run(hasura, mailer, event);
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ action: 'invite_all', sent: 2, writeErrors: 1 });
  });
});

describe('a failure before any mail was sent', () => {
  it('still gives a 500 so that Hasura retries', async () => {
    const hasura = fakeHasura(two(), { failRead: true });
    const mailer = fakeMailer();
    let status = 0;
    const res = {
      status(code: number) {
        status = code;
        return { json: () => undefined };
      },
    };
    await respond(res, () => run(hasura, mailer, moved()));
    expect(status).toBe(500);
    expect(mailer.send).not.toHaveBeenCalled();
  });
});
