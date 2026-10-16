import { describe, expect, it } from 'vitest';
import { NOTIFICATION_KIND_LABELS, notificationHref } from '@/lib/notifications';

describe('NOTIFICATION_KIND_LABELS', () => {
  it('gives the French wording of the six kinds', () => {
    expect(NOTIFICATION_KIND_LABELS).toEqual({
      lease_ending_soon: 'Bail bientôt à échéance',
      lease_grace: 'Bail échu · à renouveler',
      lease_expired: 'Bail expiré',
      registration_due: 'Enregistrement à faire',
      registration_overdue: 'Enregistrement en retard',
      appointment_reminder: 'Rappel de rendez-vous',
    });
  });
});

describe('notificationHref', () => {
  it('prefers the stored link', () => {
    expect(notificationHref({ link: '/baux/1', leaseId: '2', appointmentId: '3' })).toBe('/baux/1');
  });

  it('falls back to the lease, then the appointment, then the home page', () => {
    expect(notificationHref({ link: null, leaseId: '2', appointmentId: '3' })).toBe('/baux/2');
    expect(notificationHref({ link: null, leaseId: null, appointmentId: '3' })).toBe('/calendrier?rendezvous=3');
    expect(notificationHref({ link: null, leaseId: null, appointmentId: null })).toBe('/');
  });

  it('treats an empty link as unset', () => {
    expect(notificationHref({ link: '', leaseId: '2', appointmentId: null })).toBe('/baux/2');
  });
});
