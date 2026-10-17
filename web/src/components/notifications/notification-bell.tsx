'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, RotateCw } from 'lucide-react';
import { SkeletonList } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useT } from '@/i18n/provider';
import { formatNotificationTime, notificationHref, notificationKindLabel } from '@/lib/notifications';
import { showError } from '@/lib/show-error';
import { useGraphql } from '@/lib/use-graphql';
import { cn } from '@/lib/utils';
import {
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_QUERY,
  type NotificationRow,
  type NotificationsData,
} from './notification-mutations';

const POLL_INTERVAL_MS = 60_000;
const MAX_BADGE = 99;
const SKELETON_ROWS = 3;

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

type ItemProps = { row: NotificationRow; unreadLabel: string; onOpen: (row: NotificationRow) => void };

function NotificationItem({ row, unreadLabel, onOpen }: ItemProps) {
  const unread = row.read_at === null;
  const href = notificationHref({ link: row.link, leaseId: row.lease_id, appointmentId: row.appointment_id });
  return (
    <DropdownMenuItem asChild className="items-start gap-2 py-2 text-start">
      <Link href={href} onClick={() => onOpen(row)}>
        <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-primary' : 'bg-transparent')} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>
            {notificationKindLabel(row.kind)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            <bdi>{row.title}</bdi>
          </span>
          <span className="block text-xs text-muted-foreground">
            <time dateTime={row.created_at} dir="ltr" className="tabular-nums">
              {formatNotificationTime(row.created_at)}
            </time>
          </span>
          {unread && <span className="sr-only">{unreadLabel}</span>}
        </span>
      </Link>
    </DropdownMenuItem>
  );
}

export function NotificationBell() {
  const t = useT();
  const [reloadKey, reload] = usePollingReloadKey();
  const result = useGraphql<NotificationsData>(NOTIFICATIONS_QUERY, undefined, reloadKey);

  // Keep showing the last answer while a refetch is in flight, so the list never blanks out.
  const [shown, setShown] = useState<NotificationsData | null>(null);
  if (result.status === 'success' && result.data !== shown) setShown(result.data);

  const unread = shown?.notifications_aggregate.aggregate.count ?? 0;
  const rows = shown?.notifications ?? [];
  const bellLabel = unread === 0 ? t.shell.notifications : t.notifications.bellUnread(unread);

  function handleMarkAll() {
    markAllNotificationsRead().then(reload, (error: unknown) =>
      showError(t.notifications.markAllReadError, error, handleMarkAll),
    );
  }

  function handleOpen(row: NotificationRow) {
    if (row.read_at !== null) return;
    markNotificationRead(row.id).then(reload, (error: unknown) =>
      showError(t.notifications.markReadError, error, () => handleOpen(row)),
    );
  }

  return (
    <>
      <span className="sr-only" aria-live="polite">
        {unread > 0 ? bellLabel : ''}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label={bellLabel}>
            <Bell />
            {unread > 0 && (
              <span
                dir="ltr"
                aria-hidden
                className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums ring-2 ring-background"
              >
                {unread > MAX_BADGE ? `${MAX_BADGE}+` : unread}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
          <DropdownMenuLabel>{t.shell.notifications}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {shown === null && result.status === 'error' && (
            <>
              <p role="alert" className="m-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {t.notifications.loadError}
              </p>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  reload();
                }}
              >
                <RotateCw aria-hidden />
                {t.common.retry}
              </DropdownMenuItem>
            </>
          )}
          {shown === null && result.status === 'loading' && (
            <SkeletonList count={SKELETON_ROWS} className="space-y-2 p-2" itemClassName="h-12 rounded-lg bg-muted" />
          )}
          {shown !== null && rows.length === 0 && (
            <div className="m-1 flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              <BellOff className="size-5" aria-hidden />
              {t.shell.noNotifications}
            </div>
          )}
          {rows.length > 0 && (
            <div className="max-h-80 overflow-y-auto">
              {rows.map((row) => (
                <NotificationItem key={row.id} row={row} unreadLabel={t.notifications.unread} onOpen={handleOpen} />
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
            {t.notifications.markAllRead}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
