import { describe, expect, it } from 'vitest';
import { appointment, appointmentEvent, fakeHasura, part, run } from './appointment-fixtures';
import { fakeMailer } from './fakes';

const base = { id: 'a1', status: 'planned', starts_at: 'a', ends_at: 'b', location: 'Rue 1', notes: null };
const turnedOn = () => appointmentEvent({ ...base, notify_by_email: false }, { ...base, notify_by_email: true });

describe('notify_by_email turned on after creation', () => {
  it('invites only skipped, pending and failed participants that have an address', async () => {
    const hasura = fakeHasura(
      appointment({
        participants: [
          part('c1', 'c1@x.tn', 'skipped'),
          part('c2', 'c2@x.tn', 'pending'),
          part('c3', 'c3@x.tn', 'failed'),
          part('c4', 'c4@x.tn', 'sent'),
          part('c5', null, 'skipped'),
        ],
      }),
    );
    const mailer = fakeMailer();
    const out = await run(hasura, mailer, turnedOn());
    expect(out.status).toBe(200);
    expect(mailer.send.mock.calls.map((c) => c[0].to)).toEqual(['c1@x.tn', 'c2@x.tn', 'c3@x.tn']);
    expect(mailer.send.mock.calls[0]![0].subject).toBe('Invitation : Visite Lot 4');
    expect(hasura.writes.map((w) => [w.contactId, w.set.email_status])).toEqual([
      ['c1', 'sent'],
      ['c2', 'sent'],
      ['c3', 'sent'],
    ]);
  });

  it('records a failed send as failed with the error and keeps going', async () => {
    const hasura = fakeHasura(appointment({ participants: [part('c1', 'c1@x.tn', 'skipped'), part('c2', 'c2@x.tn', 'skipped')] }));
    const mailer = fakeMailer(async (m) => {
      if (m.to === 'c1@x.tn') throw new Error('smtp down');
    });
    await run(hasura, mailer, turnedOn());
    expect(hasura.writes).toEqual([
      { contactId: 'c1', set: { email_status: 'failed', email_error: 'smtp down' } },
      { contactId: 'c2', set: { email_status: 'sent', email_error: null } },
    ]);
  });

  it('never re-sends to a participant that is already sent', async () => {
    const hasura = fakeHasura(appointment({ participants: [part('c1', 'c1@x.tn', 'sent')] }));
    const mailer = fakeMailer();
    await run(hasura, mailer, turnedOn());
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.writes).toHaveLength(0);
  });

  it('sends nothing when the stored appointment is not planned', async () => {
    const hasura = fakeHasura(appointment({ status: 'cancelled', participants: [part('c1', 'c1@x.tn', 'skipped')] }));
    const mailer = fakeMailer();
    await run(hasura, mailer, turnedOn());
    expect(mailer.send).not.toHaveBeenCalled();
  });
});

describe('contacts who got an address later', () => {
  const cancelling = (oldNotify: boolean) =>
    appointmentEvent({ ...base, notify_by_email: oldNotify }, { ...base, status: 'cancelled', notify_by_email: true });

  it('mails a skipped participant on cancellation when the appointment was already notifying', async () => {
    const hasura = fakeHasura(appointment({ status: 'cancelled', participants: [part('c1', 'c1@x.tn', 'skipped')] }));
    const mailer = fakeMailer();
    await run(hasura, mailer, cancelling(true));
    expect(mailer.send.mock.calls.map((c) => c[0].to)).toEqual(['c1@x.tn']);
    expect(mailer.send.mock.calls[0]![0].subject).toBe('Rendez-vous annulé : Visite Lot 4');
  });

  it('keeps a participant skipped because notifications were off before excluded', async () => {
    const hasura = fakeHasura(appointment({ status: 'cancelled', participants: [part('c1', 'c1@x.tn', 'skipped')] }));
    const mailer = fakeMailer();
    await run(hasura, mailer, cancelling(false));
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('mails a skipped participant on update when the appointment was already notifying', async () => {
    const hasura = fakeHasura(appointment({ participants: [part('c1', 'c1@x.tn', 'skipped')] }));
    const mailer = fakeMailer();
    const event = appointmentEvent({ ...base, notify_by_email: true }, { ...base, location: 'Rue 2', notify_by_email: true });
    await run(hasura, mailer, event);
    expect(mailer.send.mock.calls[0]![0].subject).toBe('Rendez-vous modifié : Visite Lot 4');
  });
});
