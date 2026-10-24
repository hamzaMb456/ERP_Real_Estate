import { afterEach, describe, expect, it } from 'vitest';
import { activateLocale } from '@/i18n/store';
import { formatNotificationTime, notificationHref, notificationKindLabel, notificationKindLabels } from '@/lib/notifications';

afterEach(() => activateLocale('fr'));

describe('notificationKindLabels', () => {
  it('gives the French wording of the eight kinds', () => {
    expect(notificationKindLabels()).toEqual({
      lease_ending_soon: 'Bail bientôt à échéance',
      lease_grace: 'Bail échu · à renouveler',
      lease_expired: 'Bail expiré',
      registration_due: 'Enregistrement à faire',
      registration_overdue: 'Enregistrement en retard',
      appointment_reminder: 'Rappel de rendez-vous',
      rental_request: 'Demande de location',
      visit_request: 'Demande de visite',
    });
  });

  it('reads the dictionary of the current language at call time', () => {
    activateLocale('en');
    expect(notificationKindLabels().lease_expired).toBe('Lease expired');
    activateLocale('ar');
    expect(notificationKindLabels().appointment_reminder).toBe('تذكير بموعد');
  });
});

describe('notificationKindLabel', () => {
  it('labels a known kind', () => {
    expect(notificationKindLabel('registration_overdue')).toBe('Enregistrement en retard');
  });

  it('shows an unknown kind as stored, ignoring inherited keys', () => {
    expect(notificationKindLabel('something_new')).toBe('something_new');
    expect(notificationKindLabel('toString')).toBe('toString');
  });
});

describe('formatNotificationTime', () => {
  it('formats in Tunis time with the current language', () => {
    // fr-TN: Tunisian date order; the hour cycle follows the ICU data of the runtime.
    expect(formatNotificationTime('2026-10-16T09:30:00Z')).toMatch(/^16\/10\/2026 10:30/);
    activateLocale('en');
    expect(formatNotificationTime('2026-10-16T23:30:00Z')).toBe('17/10/2026, 00:30');
  });
});

describe('notificationHref', () => {
  it('prefers the stored link', () => {
    expect(notificationHref({ link: '/erp/baux/1', leaseId: '2', appointmentId: '3' })).toBe('/erp/baux/1');
  });

  it('falls back to the lease, then the appointment, then the dashboard', () => {
    expect(notificationHref({ link: null, leaseId: '2', appointmentId: '3' })).toBe('/erp/baux/2');
    expect(notificationHref({ link: null, leaseId: null, appointmentId: '3' })).toBe('/erp/calendrier?rendezvous=3');
    expect(notificationHref({ link: null, leaseId: null, appointmentId: null })).toBe('/erp');
  });

  it('treats an empty link as unset', () => {
    expect(notificationHref({ link: '', leaseId: '2', appointmentId: null })).toBe('/erp/baux/2');
  });
});
