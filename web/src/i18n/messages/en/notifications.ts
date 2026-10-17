import type { notifications as fr } from '../fr/notifications';
import { plural } from '../../plural';

export const notifications: typeof fr = {
  bellUnread: (count: number) => plural(count, { one: 'Notifications, # unread', other: 'Notifications, # unread' }),
  unread: 'Unread',
  markAllRead: 'Mark all as read',
  loadError: 'Could not load the notifications.',
  markAllReadError: 'Could not mark the notifications as read',
  markReadError: 'Could not mark the notification as read',
  kinds: {
    lease_ending_soon: 'Lease ending soon',
    lease_grace: 'Lease overdue · to renew',
    lease_expired: 'Lease expired',
    registration_due: 'Registration due',
    registration_overdue: 'Registration overdue',
    appointment_reminder: 'Appointment reminder',
  },
};
