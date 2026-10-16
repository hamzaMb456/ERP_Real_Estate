import { describe, expect, it } from 'vitest';
import type { AppointmentStatus } from '@/lib/appointment-types';
import {
  APPOINTMENT_KIND_LABELS,
  APPOINTMENT_STATUS_LABELS,
  PARTICIPANT_ROLE_LABELS,
  emailStatusLabel,
  findStaffConflicts,
  isoToTunisParts,
  participantEmailLabel,
  tunisToIso,
} from '@/lib/appointments';

describe('labels', () => {
  it('gives French wording for kinds, roles and statuses', () => {
    expect(APPOINTMENT_KIND_LABELS.viewing).toBe('Visite');
    expect(APPOINTMENT_KIND_LABELS.move_in).toBe('État des lieux d’entrée');
    expect(APPOINTMENT_KIND_LABELS.move_out).toBe('État des lieux de sortie');
    expect(APPOINTMENT_KIND_LABELS.meeting).toBe('Rendez-vous');
    expect(APPOINTMENT_KIND_LABELS.other).toBe('Autre');
    expect(PARTICIPANT_ROLE_LABELS.renter).toBe('Locataire');
    expect(PARTICIPANT_ROLE_LABELS.guarantor).toBe('Garant');
    expect(PARTICIPANT_ROLE_LABELS.prospect).toBe('Prospect');
    expect(PARTICIPANT_ROLE_LABELS.buyer).toBe('Acheteur');
    expect(PARTICIPANT_ROLE_LABELS.other).toBe('Autre');
    expect(APPOINTMENT_STATUS_LABELS).toEqual({ planned: 'Prévu', done: 'Fait', cancelled: 'Annulé' });
  });
});

describe('emailStatusLabel', () => {
  it('labels every e-mail status', () => {
    expect(emailStatusLabel('sent')).toBe('E-mail envoyé');
    expect(emailStatusLabel('failed')).toBe('E-mail non envoyé · Renvoyer');
    expect(emailStatusLabel('skipped')).toBe('Pas d’adresse e-mail');
    expect(emailStatusLabel('pending')).toBe('En attente');
  });
});

describe('participantEmailLabel', () => {
  it('says the e-mails are off when notifications are disabled and the participant was skipped', () => {
    expect(participantEmailLabel('skipped', { notifyByEmail: false, hasEmail: true })).toBe('E-mail désactivé');
    expect(participantEmailLabel('skipped', { notifyByEmail: false, hasEmail: false })).toBe('E-mail désactivé');
  });

  it('keeps « Pas d’adresse e-mail » only when notifications are on and the contact has no address', () => {
    expect(participantEmailLabel('skipped', { notifyByEmail: true, hasEmail: false })).toBe('Pas d’adresse e-mail');
  });

  it('does not blame a missing address when the contact has one', () => {
    expect(participantEmailLabel('skipped', { notifyByEmail: true, hasEmail: true })).toBe('Aucun e-mail envoyé');
  });

  it('falls back to the status label for the other statuses', () => {
    expect(participantEmailLabel('sent', { notifyByEmail: false, hasEmail: true })).toBe('E-mail envoyé');
    expect(participantEmailLabel('pending', { notifyByEmail: true, hasEmail: true })).toBe('En attente');
    expect(participantEmailLabel('failed', { notifyByEmail: true, hasEmail: true })).toBe('E-mail non envoyé · Renvoyer');
  });
});

describe('tunisToIso / isoToTunisParts', () => {
  it('builds an ISO string with the +01:00 offset', () => {
    expect(tunisToIso('2026-10-16', '09:30')).toBe('2026-10-16T09:30:00+01:00');
  });

  it('round-trips 23:30 without shifting the day', () => {
    const iso = tunisToIso('2026-10-16', '23:30');
    expect(isoToTunisParts(iso)).toEqual({ date: '2026-10-16', time: '23:30' });
  });

  it('reads a UTC instant in Tunis time, crossing midnight', () => {
    expect(isoToTunisParts('2026-10-16T23:30:00Z')).toEqual({ date: '2026-10-17', time: '00:30' });
  });

  it('keeps a midnight Tunis instant on its own day', () => {
    expect(isoToTunisParts('2026-10-15T23:00:00+00:00')).toEqual({ date: '2026-10-16', time: '00:00' });
  });
});

describe('findStaffConflicts', () => {
  const at = (hourStart: number, hourEnd: number) => ({
    startsAt: tunisToIso('2026-10-16', `${String(hourStart).padStart(2, '0')}:00`),
    endsAt: tunisToIso('2026-10-16', `${String(hourEnd).padStart(2, '0')}:00`),
  });
  const other = (id: string, staff: string | null, h1: number, h2: number, status: AppointmentStatus = 'planned') => ({
    id,
    assignedUserId: staff,
    status,
    ...at(h1, h2),
  });
  const candidate = { assignedUserId: 'u1', ...at(10, 11) };

  it('reports only overlapping planned rows of the same staff member', () => {
    const others = [
      other('overlap', 'u1', 10, 12),
      other('inside', 'u1', 10, 11),
      other('before', 'u1', 8, 10),
      other('after', 'u1', 11, 12),
      other('elsewhere', 'u2', 10, 11),
    ];
    expect(findStaffConflicts(candidate, others)).toEqual(['overlap', 'inside']);
  });

  it('ignores cancelled and done appointments', () => {
    const others = [other('c', 'u1', 10, 11, 'cancelled'), other('d', 'u1', 10, 11, 'done')];
    expect(findStaffConflicts(candidate, others)).toEqual([]);
  });

  it('excludes the candidate itself', () => {
    expect(findStaffConflicts({ ...candidate, id: 'me' }, [other('me', 'u1', 10, 11), other('x', 'u1', 10, 11)])).toEqual(['x']);
  });

  it('has no conflicts when no staff member is assigned', () => {
    expect(findStaffConflicts({ ...candidate, assignedUserId: null }, [other('n', null, 10, 11)])).toEqual([]);
  });
});
