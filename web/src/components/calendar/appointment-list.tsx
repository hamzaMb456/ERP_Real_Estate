import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { APPOINTMENT_KIND_LABELS, APPOINTMENT_STATUS_LABELS } from '@/lib/appointments';
import type { AppointmentKind, AppointmentStatus, FeedRow } from '@/lib/appointment-types';
import { isoToTunisParts } from '@/lib/appointments';
import { formatWhen } from './calendar-format';

/** What a line of the list needs: a calendar_feed row fits, and so does a participation's appointment. */
export type AppointmentListItem = Pick<FeedRow, 'event_id' | 'appointment_id' | 'title' | 'kind' | 'starts_at' | 'location' | 'status'>;

/** Opens the appointment's sheet on the calendar, on the right day. */
export const appointmentHref = (row: AppointmentListItem): string =>
  `/calendrier?rendezvous=${row.appointment_id}&date=${isoToTunisParts(row.starts_at).date}`;

/** Appointments as links to the calendar, one line each (the lease tab and the contact page use it). */
export function AppointmentList({ rows, emptyText }: { rows: AppointmentListItem[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.event_id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <Link href={appointmentHref(row)} className="font-medium text-primary hover:underline">
              {row.title}
            </Link>
            <p className="text-xs text-muted-foreground">
              {APPOINTMENT_KIND_LABELS[row.kind as AppointmentKind] ?? row.kind} · {formatWhen(row.starts_at)}
              {row.location ? ` · ${row.location}` : ''}
            </p>
          </div>
          {row.status !== 'planned' && (
            <Badge variant={row.status === 'cancelled' ? 'destructive' : 'outline'}>{APPOINTMENT_STATUS_LABELS[row.status as AppointmentStatus]}</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}
