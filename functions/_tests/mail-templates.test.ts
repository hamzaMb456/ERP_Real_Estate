import { describe, expect, it } from 'vitest';
import { appointmentMail, notificationMail } from '../_lib/mail-templates';

describe('notificationMail', () => {
  it('builds a French subject from the kind and the title', () => {
    const mail = notificationMail({ kind: 'lease_ending_soon', title: 'Bail 12', body: null, link: null });
    expect(mail.subject).toBe('Bail bientôt à échéance : Bail 12');
  });

  it.each([
    ['lease_grace', 'Bail échu · à renouveler'],
    ['lease_expired', 'Bail expiré'],
    ['registration_due', 'Enregistrement à faire'],
    ['registration_overdue', 'Enregistrement en retard'],
    ['appointment_reminder', 'Rappel de rendez-vous'],
  ])('labels %s', (kind, label) => {
    const mail = notificationMail({ kind, title: 'T1', body: null, link: null });
    expect(mail.subject).toContain(label);
    expect(mail.subject).toContain('T1');
  });

  it('falls back to a generic label for an unknown kind', () => {
    expect(notificationMail({ kind: 'weird', title: 'T', body: null, link: null }).subject).toContain('Notification');
  });

  it('includes the body and an absolute link built from APP_URL', () => {
    const mail = notificationMail(
      { kind: 'lease_expired', title: 'Bail 3', body: 'Le bail a pris fin.', link: '/baux/abc' },
      'https://erp.example.tn/',
    );
    expect(mail.text).toContain('Le bail a pris fin.');
    expect(mail.text).toContain('https://erp.example.tn/baux/abc');
  });

  it('leaves a relative link out when APP_URL is not set', () => {
    const mail = notificationMail({ kind: 'lease_expired', title: 'Bail 3', body: null, link: '/baux/abc' });
    expect(mail.text).not.toContain('/baux/abc');
  });

  it('keeps an absolute link as is', () => {
    const mail = notificationMail({ kind: 'lease_expired', title: 'Bail 3', body: null, link: 'https://x.tn/a' });
    expect(mail.text).toContain('https://x.tn/a');
  });
});

describe('appointmentMail', () => {
  const appt = {
    title: 'Visite Lot 4',
    kind: 'viewing',
    startsAt: '2026-11-03T09:30:00Z',
    endsAt: '2026-11-03T10:30:00Z',
    location: 'Rue 1, Tunis',
  };

  it('writes a French subject per kind of mail', () => {
    expect(appointmentMail('invitation', appt).subject).toBe('Invitation : Visite Lot 4');
    expect(appointmentMail('update', appt).subject).toBe('Rendez-vous modifié : Visite Lot 4');
    expect(appointmentMail('cancellation', appt).subject).toBe('Rendez-vous annulé : Visite Lot 4');
  });

  it('shows the Tunis-time date and the place', () => {
    const text = appointmentMail('invitation', appt).text;
    expect(text).toContain('Rue 1, Tunis');
    expect(text).toMatch(/2026/);
    expect(text).toMatch(/10:30|10 h 30/);
  });

  it('omits the place when there is none', () => {
    expect(appointmentMail('invitation', { ...appt, location: null }).text).not.toContain('Lieu');
  });
});
