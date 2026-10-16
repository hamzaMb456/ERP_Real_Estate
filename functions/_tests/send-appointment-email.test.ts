import { describe, expect, it, vi } from 'vitest';
import handler, { handleAppointmentEmail } from '../send-appointment-email';
import { ENV, HEADERS, appointment, fakeHasura, newParticipant, participantEvent, part, run } from './appointment-fixtures';
import { fakeMailer } from './fakes';

describe('participant events', () => {
  it('invites a participant with an e-mail address and marks it sent', async () => {
    const hasura = fakeHasura(appointment());
    const mailer = fakeMailer();
    const out = await run(hasura, mailer, participantEvent('INSERT', newParticipant));
    expect(out.status).toBe(200);
    expect(mailer.send).toHaveBeenCalledOnce();
    expect(mailer.send.mock.calls[0]![0]).toMatchObject({ to: 'c1@x.tn', subject: 'Invitation : Visite Lot 4' });
    expect(hasura.writes).toEqual([{ contactId: 'c1', set: { email_status: 'sent', email_error: null } }]);
  });

  it('marks a participant without an address skipped and sends nothing', async () => {
    const hasura = fakeHasura(appointment({ participants: [part('c1', null)] }));
    const mailer = fakeMailer();
    await run(hasura, mailer, participantEvent('INSERT', newParticipant));
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.writes).toEqual([{ contactId: 'c1', set: { email_status: 'skipped', email_error: null } }]);
  });

  it('marks the participant skipped when the appointment does not notify by e-mail', async () => {
    const hasura = fakeHasura(appointment({ notify_by_email: false }));
    const mailer = fakeMailer();
    await run(hasura, mailer, participantEvent('INSERT', newParticipant));
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.writes[0]?.set.email_status).toBe('skipped');
  });

  it('sends nothing for a retried insert whose event row is already sent', async () => {
    const hasura = fakeHasura(appointment());
    const mailer = fakeMailer();
    await run(hasura, mailer, participantEvent('INSERT', { ...newParticipant, email_status: 'sent' }));
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.writes).toHaveLength(0);
  });

  it('sends nothing for a retried insert whose stored row is already sent', async () => {
    const hasura = fakeHasura(appointment({ participants: [part('c1', 'c1@x.tn', 'sent')] }));
    const mailer = fakeMailer();
    await run(hasura, mailer, participantEvent('INSERT', newParticipant));
    expect(mailer.send).not.toHaveBeenCalled();
    expect(hasura.writes).toHaveLength(0);
  });

  it('sends again on Renvoyer (email_status back to pending)', async () => {
    const hasura = fakeHasura(appointment());
    const mailer = fakeMailer();
    await run(hasura, mailer, participantEvent('UPDATE', newParticipant, { ...newParticipant, email_status: 'sent' }));
    expect(mailer.send).toHaveBeenCalledOnce();
    expect(hasura.writes[0]?.set.email_status).toBe('sent');
  });

  it('writes failed with the error and still returns 200 when the SMTP send fails', async () => {
    const hasura = fakeHasura(appointment());
    const mailer = fakeMailer(async () => {
      throw new Error('smtp down');
    });
    const out = await run(hasura, mailer, participantEvent('INSERT', newParticipant));
    expect(out.status).toBe(200);
    expect(hasura.writes).toEqual([{ contactId: 'c1', set: { email_status: 'failed', email_error: 'smtp down' } }]);
  });
});

describe('security and wiring', () => {
  it('returns 401 without a valid secret and sends no query', async () => {
    const hasura = fakeHasura(appointment());
    const mailer = fakeMailer();
    const out = await run(hasura, mailer, participantEvent('INSERT', newParticipant), {} as Record<string, string>);
    expect(out.status).toBe(401);
    expect(hasura.queries).toHaveLength(0);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('names the missing SMTP variable with status 500 when a mail has to be sent', async () => {
    const hasura = fakeHasura(appointment());
    const out = await handleAppointmentEmail(
      { headers: HEADERS, body: participantEvent('INSERT', newParticipant), env: { ...ENV, SMTP_HOST: 'h' } },
      { client: hasura.client },
    );
    expect(out.status).toBe(500);
    expect(JSON.stringify(out.body)).toContain('SMTP_PORT');
  });

  it('default export writes the core result through res', async () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await handler({ headers: {}, body: {} }, { status });
    expect(status).toHaveBeenCalledWith(401);
  });
});
