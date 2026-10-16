import { describe, expect, it } from 'vitest';
import { appointment, appointmentEvent, fakeHasura, part, run } from './appointment-fixtures';
import { fakeMailer } from './fakes';

describe('appointment events', () => {
  const base = { status: 'planned', starts_at: 'a', ends_at: 'b', location: 'Rue 1', notes: null };

  it('cancels: mails every participant with an address, skips the others', async () => {
    const appt = appointment({
      status: 'cancelled',
      participants: [part('c1', 'c1@x.tn', 'sent'), part('c2', 'c2@x.tn', 'failed'), part('c3', null, 'sent'), part('c4', 'c4@x.tn', 'skipped')],
    });
    const hasura = fakeHasura(appt);
    const mailer = fakeMailer();
    const out = await run(hasura, mailer, appointmentEvent({ id: 'a1', ...base }, { id: 'a1', ...base, status: 'cancelled' }));
    expect(out.status).toBe(200);
    expect(mailer.send.mock.calls.map((c) => c[0].to)).toEqual(['c1@x.tn', 'c2@x.tn']);
    expect(mailer.send.mock.calls[0]![0].subject).toBe('Rendez-vous annulé : Visite Lot 4');
    expect(hasura.writes.map((w) => [w.contactId, w.set.email_status])).toEqual([
      ['c3', 'skipped'],
      ['c1', 'sent'],
      ['c2', 'sent'],
    ]);
  });

  it('sends an update mail when the place changes', async () => {
    const hasura = fakeHasura(appointment());
    const mailer = fakeMailer();
    await run(hasura, mailer, appointmentEvent({ id: 'a1', ...base }, { id: 'a1', ...base, location: 'Rue 2' }));
    expect(mailer.send.mock.calls[0]![0].subject).toBe('Rendez-vous modifié : Visite Lot 4');
  });

  it('sends nothing when only the notes changed', async () => {
    const hasura = fakeHasura(appointment());
    const mailer = fakeMailer();
    const out = await run(hasura, mailer, appointmentEvent({ id: 'a1', ...base }, { id: 'a1', ...base, notes: 'x' }));
    expect(out.status).toBe(200);
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.queries).toHaveLength(0);
  });

  it('sends nothing when the appointment does not notify by e-mail', async () => {
    const hasura = fakeHasura(appointment({ notify_by_email: false, status: 'cancelled' }));
    const mailer = fakeMailer();
    await run(hasura, mailer, appointmentEvent({ id: 'a1', ...base }, { id: 'a1', ...base, status: 'cancelled' }));
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.writes).toHaveLength(0);
  });

  it('marks a participant failed when SMTP fails and still returns 200', async () => {
    const hasura = fakeHasura(appointment({ status: 'cancelled' }));
    const mailer = fakeMailer(async () => {
      throw new Error('boom');
    });
    const out = await run(hasura, mailer, appointmentEvent({ id: 'a1', ...base }, { id: 'a1', ...base, status: 'cancelled' }));
    expect(out.status).toBe(200);
    expect(hasura.writes).toEqual([{ contactId: 'c1', set: { email_status: 'failed', email_error: 'boom' } }]);
  });
});

