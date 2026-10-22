import type { NotificationKind } from '@/lib/appointment-types';
import { getIntlLocale, getMessages } from '@/i18n/store';

/** Wording of the six kinds in the current language (titles stored in the database are ASCII). */
export function notificationKindLabels(): Record<NotificationKind, string> {
  return getMessages().notifications.kinds;
}

/** Wording of one kind; an unknown kind is shown as stored rather than hidden. */
export function notificationKindLabel(kind: string): string {
  const labels: Record<string, string> = notificationKindLabels();
  return Object.hasOwn(labels, kind) ? labels[kind] : kind;
}

/** Date and time a notification was created, in Tunis time and the current language's short format. */
export function formatNotificationTime(iso: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(), { timeZone: 'Africa/Tunis', dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

/** Where a notification leads: its stored link, else its lease, else its appointment, else the dashboard. */
export function notificationHref(row: {
  link: string | null;
  leaseId: string | null;
  appointmentId: string | null;
}): string {
  if (row.link) return row.link;
  if (row.leaseId) return `/erp/baux/${row.leaseId}`;
  if (row.appointmentId) return `/erp/calendrier?rendezvous=${row.appointmentId}`;
  return '/erp';
}
