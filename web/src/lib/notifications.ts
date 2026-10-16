import type { NotificationKind } from '@/lib/appointment-types';

// Titles stored in the database are ASCII; the French wording of each kind lives here.
export const NOTIFICATION_KIND_LABELS: Record<NotificationKind, string> = {
  lease_ending_soon: 'Bail bientôt à échéance',
  lease_grace: 'Bail échu · à renouveler',
  lease_expired: 'Bail expiré',
  registration_due: 'Enregistrement à faire',
  registration_overdue: 'Enregistrement en retard',
  appointment_reminder: 'Rappel de rendez-vous',
};

/** Where a notification leads: its stored link, else its lease, else its appointment, else home. */
export function notificationHref(row: {
  link: string | null;
  leaseId: string | null;
  appointmentId: string | null;
}): string {
  if (row.link) return row.link;
  if (row.leaseId) return `/baux/${row.leaseId}`;
  if (row.appointmentId) return `/calendrier?rendezvous=${row.appointmentId}`;
  return '/';
}
