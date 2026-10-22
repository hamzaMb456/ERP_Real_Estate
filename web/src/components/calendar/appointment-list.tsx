import Link from 'next/link';
import type { LucideIcon } from '@/components/icons';
import type { AppointmentStatus, FeedRow } from '@/lib/appointment-types';
import { appointmentKindLabel, isoToTunisParts } from '@/lib/appointments';
import { AppointmentStatusBadge } from './appointment-status-badge';
import { CalendarEmptyState } from './calendar-empty-state';
import { formatShortDay, formatTime } from './calendar-format';

/** What a line of the list needs: a calendar_feed row fits, and so does a participation's appointment. */
export type AppointmentListItem = Pick<FeedRow, 'event_id' | 'appointment_id' | 'title' | 'kind' | 'starts_at' | 'location' | 'status'>;

/** Opens the appointment's sheet on the calendar, on the right day. */
export const appointmentHref = (row: AppointmentListItem): string =>
  `/calendrier?rendezvous=${row.appointment_id}&date=${isoToTunisParts(row.starts_at).date}`;

type Props = {
  rows: AppointmentListItem[];
  /** Shown in a dashed muted block when there is no row. */
  empty: { icon: LucideIcon; title: string; body?: string };
};

/** Appointments as links to the calendar, one line each (the lease tab and the contact page use it). */
export function AppointmentList({ rows, empty }: Props) {
  if (rows.length === 0) return <CalendarEmptyState icon={empty.icon} title={empty.title} body={empty.body} className="py-6" />;
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.event_id} className="flex flex-wrap items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <Link href={appointmentHref(row)} className="font-medium text-primary hover:underline">
              {row.title}
            </Link>
            <p className="text-xs text-muted-foreground">
              {appointmentKindLabel(row.kind)} · {formatShortDay(row.starts_at)} ·{' '}
              <span dir="ltr" className="tabular-nums">
                {formatTime(row.starts_at)}
              </span>
              {row.location ? ` · ${row.location}` : ''}
            </p>
          </div>
          {row.status !== 'planned' && <AppointmentStatusBadge status={row.status as AppointmentStatus} />}
        </li>
      ))}
    </ul>
  );
}
