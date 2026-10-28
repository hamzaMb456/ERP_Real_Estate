import { describe, expect, it } from 'vitest';
import { decideAppointmentAction, decideParticipantAction } from '../_lib/appointment-decisions';
import type { RowChangeEvent } from '../_lib/event';

const participantEvent = (
  op: RowChangeEvent['event']['op'],
  next: Record<string, unknown>,
  old: Record<string, unknown> | null = null,
): RowChangeEvent => ({
  event: { op, data: { old, new: next } },
  table: { schema: 'public', name: 'appointment_participants' },
  trigger: { name: 't' },
});

const appointmentEvent = (old: Record<string, unknown>, next: Record<string, unknown>): RowChangeEvent => ({
  event: { op: 'UPDATE', data: { old, new: next } },
  table: { schema: 'public', name: 'appointments' },
  trigger: { name: 't' },
});

const OK = { planned: true, notifyByEmail: true, email: 'c@x.tn' };

describe('decideParticipantAction', () => {
  it('invites on a pending insert', () => {
    expect(decideParticipantAction(participantEvent('INSERT', { email_status: 'pending' }))).toBe('invite');
    expect(decideParticipantAction(participantEvent('INSERT', { email_status: 'pending' }), OK)).toBe('invite');
  });

  it('does nothing when the row is already sent', () => {
    expect(decideParticipantAction(participantEvent('INSERT', { email_status: 'sent' }), OK)).toBe('none');
  });

  it('invites on Renvoyer (email_status changes to pending)', () => {
    const event = participantEvent('UPDATE', { email_status: 'pending' }, { email_status: 'sent' });
    expect(decideParticipantAction(event, OK)).toBe('invite');
  });

  it('does nothing for other updates', () => {
    expect(decideParticipantAction(participantEvent('UPDATE', { email_status: 'sent' }, { email_status: 'pending' }))).toBe('none');
    expect(decideParticipantAction(participantEvent('UPDATE', { email_status: 'pending' }, { email_status: 'pending' }))).toBe('none');
    expect(decideParticipantAction(participantEvent('DELETE', { email_status: 'pending' }))).toBe('none');
  });

  it.each([
    ['the appointment is not planned', { ...OK, planned: false }],
    ['the appointment does not notify by e-mail', { ...OK, notifyByEmail: false }],
    ['the contact has no e-mail address', { ...OK, email: null }],
  ])('skips when %s', (_label, ctx) => {
    expect(decideParticipantAction(participantEvent('INSERT', { email_status: 'pending' }), ctx)).toBe('skip');
  });

  it('ignores events from another table', () => {
    const event = { ...participantEvent('INSERT', { email_status: 'pending' }), table: { schema: 'public', name: 'other' } };
    expect(decideParticipantAction(event)).toBe('none');
  });
});

describe('decideAppointmentAction', () => {
  const base = { status: 'planned', starts_at: '2026-11-03T09:00:00+00:00', ends_at: '2026-11-03T10:00:00+00:00', location: 'A', notes: null };

  it('cancels when the status becomes cancelled', () => {
    expect(decideAppointmentAction(appointmentEvent(base, { ...base, status: 'cancelled' }))).toBe('cancel');
  });

  it.each([
    ['starts_at', { starts_at: '2026-11-03T10:00:00+00:00' }],
    ['ends_at', { ends_at: '2026-11-03T11:00:00+00:00' }],
    ['location', { location: 'B' }],
  ])('updates when %s changes on a planned appointment', (_field, change) => {
    expect(decideAppointmentAction(appointmentEvent(base, { ...base, ...change }))).toBe('update');
  });

  it('treats the same instant written differently as unchanged', () => {
    const next = { ...base, starts_at: '2026-11-03T09:00:00Z' };
    expect(decideAppointmentAction(appointmentEvent(base, next))).toBe('none');
  });

  it('does nothing when only the notes change', () => {
    expect(decideAppointmentAction(appointmentEvent(base, { ...base, notes: 'x' }))).toBe('none');
  });

  it('does not update an appointment that is not planned', () => {
    const cancelled = { ...base, status: 'cancelled' };
    expect(decideAppointmentAction(appointmentEvent(cancelled, { ...cancelled, location: 'B' }))).toBe('none');
    expect(decideAppointmentAction(appointmentEvent(base, { ...base, status: 'done', location: 'B' }))).toBe('none');
  });

  describe('notify_by_email turned on after creation', () => {
    const off = { ...base, notify_by_email: false };

    it('invites everyone when notifications go from false to true on a planned appointment', () => {
      expect(decideAppointmentAction(appointmentEvent(off, { ...off, notify_by_email: true }))).toBe('invite_all');
    });

    it('does nothing when notifications go from true to false', () => {
      const on = { ...base, notify_by_email: true };
      expect(decideAppointmentAction(appointmentEvent(on, { ...on, notify_by_email: false }))).toBe('none');
    });

    it('does nothing for a location change while notifications stay off', () => {
      expect(decideAppointmentAction(appointmentEvent(off, { ...off, location: 'B' }))).toBe('none');
    });

    it('does not invite for an appointment that is not planned', () => {
      const next = { ...off, notify_by_email: true, status: 'cancelled' };
      expect(decideAppointmentAction(appointmentEvent(off, next))).toBe('cancel');
      const done = { ...off, status: 'done' };
      expect(decideAppointmentAction(appointmentEvent(done, { ...done, notify_by_email: true }))).toBe('none');
    });
  });
});
