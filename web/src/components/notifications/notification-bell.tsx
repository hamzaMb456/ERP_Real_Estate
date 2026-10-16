'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NOTIFICATION_KIND_LABELS, notificationHref } from '@/lib/notifications';
import type { NotificationKind } from '@/lib/appointment-types';
import { showError } from '@/lib/show-error';
import { useGraphql } from '@/lib/use-graphql';
import {
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_QUERY,
  type NotificationRow,
  type NotificationsData,
} from './notification-mutations';

const POLL_INTERVAL_MS = 60_000;
const MAX_BADGE = 99;

const timeFormat = new Intl.DateTimeFormat('fr-TN', { timeZone: 'Africa/Tunis', dateStyle: 'short', timeStyle: 'short' });

const kindLabel = (kind: string): string => NOTIFICATION_KIND_LABELS[kind as NotificationKind] ?? kind;

function bellLabel(unread: number): string {
  if (unread === 0) return 'Notifications';
  return `Notifications, ${unread} ${unread === 1 ? 'non lue' : 'non lues'}`;
}

/** Reloads the list every minute (no websocket), except while the tab is hidden. */
function usePollingReloadKey(): [number, () => void] {
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) reload();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [reload]);
  return [reloadKey, reload];
}

function NotificationItem({ row, onOpen }: { row: NotificationRow; onOpen: (row: NotificationRow) => void }) {
  const unread = row.read_at === null;
  const href = notificationHref({ link: row.link, leaseId: row.lease_id, appointmentId: row.appointment_id });
  return (
    <DropdownMenuItem asChild className="items-start gap-2 py-2">
      <Link href={href} onClick={() => onOpen(row)}>
        <span
          className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? 'bg-primary' : 'bg-transparent'}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${unread ? 'font-semibold' : 'font-medium'}`}>{kindLabel(row.kind)}</span>
          <span className="block truncate text-xs text-muted-foreground">{row.title}</span>
          <time dateTime={row.created_at} className="block text-xs text-muted-foreground tabular-nums">
            {timeFormat.format(new Date(row.created_at))}
          </time>
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

export function NotificationBell() {
  const [reloadKey, reload] = usePollingReloadKey();
  const result = useGraphql<NotificationsData>(NOTIFICATIONS_QUERY, undefined, reloadKey);

  // Keep showing the last answer while a refetch is in flight, so the list never blanks out.
  const [shown, setShown] = useState<NotificationsData | null>(null);
  if (result.status === 'success' && result.data !== shown) setShown(result.data);

  const unread = shown?.notifications_aggregate.aggregate.count ?? 0;
  const rows = shown?.notifications ?? [];

  function handleMarkAll() {
    markAllNotificationsRead().then(reload, (error: unknown) =>
      showError('Impossible de marquer les notifications comme lues', error, handleMarkAll),
    );
  }

  function handleOpen(row: NotificationRow) {
    if (row.read_at !== null) return;
    markNotificationRead(row.id).then(reload, (error: unknown) =>
      showError('Impossible de marquer la notification comme lue', error, () => handleOpen(row)),
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={bellLabel(unread)}>
          <Bell />
          {unread > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground tabular-nums"
              aria-hidden
            >
              {unread > MAX_BADGE ? `${MAX_BADGE}+` : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {shown === null && result.status === 'error' && (
          <p role="alert" className="px-2 py-6 text-center text-sm text-destructive">
            Impossible de charger les notifications.
          </p>
        )}
        {shown === null && result.status === 'loading' && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Chargement…</p>
        )}
        {shown !== null && rows.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Aucune notification.</p>
        )}
        {rows.length > 0 && (
          <div className="max-h-80 overflow-y-auto">
            {rows.map((row) => (
              <NotificationItem key={row.id} row={row} onOpen={handleOpen} />
            ))}
          </div>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={unread === 0}
          onSelect={(event) => {
            event.preventDefault();
            handleMarkAll();
          }}
        >
          Tout marquer comme lu
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
