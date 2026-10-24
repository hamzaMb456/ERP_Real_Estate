// Notification bell of the header: unread count, list, kinds and errors.
// The bell alone and the list title read shell.notifications; the empty list reads shell.noNotifications.

import { plural } from '../../plural';

export const notifications = {
  /** Accessible name of the bell when at least one notification is unread. */
  bellUnread: (count: number) => plural(count, { one: 'Notifications, # non lue', other: 'Notifications, # non lues' }),
  /** Read by screen readers after an unread row (the dot is decorative). */
  unread: 'Non lue',
  markAllRead: 'Tout marquer comme lu',
  loadError: 'Impossible de charger les notifications.',
  markAllReadError: 'Impossible de marquer les notifications comme lues',
  markReadError: 'Impossible de marquer la notification comme lue',
  /** Wording of each kind; the titles stored in the database are ASCII ('Bail 12', the appointment title). */
  kinds: {
    lease_ending_soon: 'Bail bientôt à échéance',
    lease_grace: 'Bail échu · à renouveler',
    lease_expired: 'Bail expiré',
    registration_due: 'Enregistrement à faire',
    registration_overdue: 'Enregistrement en retard',
    appointment_reminder: 'Rappel de rendez-vous',
    rental_request: 'Demande de location',
    visit_request: 'Demande de visite',
  },
};
