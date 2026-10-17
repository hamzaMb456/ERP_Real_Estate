import { getMessages } from '@/i18n/store';
import type { FeedRow, LeaseEventKind } from '@/lib/appointment-types';
import { todayTunis } from '@/lib/dates';

/** Labels of the lease rows of the feed, in the current language (calendar dictionary). */
export const leaseEventKindLabels = (): Record<LeaseEventKind, string> => getMessages().calendar.leaseKinds;

export interface CalendarFilters {
  kinds: string[];
  contactId: string | null;
  staffId: string | null;
  branchId: string | null;
  includeCancelled: boolean;
}

/** An empty filter value means "no filter". Cancelled rows are hidden unless asked for. */
export function filterFeed(rows: FeedRow[], filters: CalendarFilters): FeedRow[] {
  return rows.filter(
    (row) =>
      (filters.includeCancelled || row.status !== 'cancelled') &&
      (filters.kinds.length === 0 || filters.kinds.includes(row.kind)) &&
      (!filters.contactId || row.contact_ids.includes(filters.contactId)) &&
      (!filters.staffId || row.assigned_user_id === filters.staffId) &&
      (!filters.branchId || row.branch_id === filters.branchId),
  );
}

export interface CalendarEventInput {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  classNames: string[];
  extendedProps: {
    source: string;
    kind: string;
    appointmentId: string | null;
    leaseId: string | null;
    unitId: string | null;
    status: string;
  };
}

function eventTitle(row: FeedRow): string {
  if (row.source !== 'lease') return row.title;
  const label = leaseEventKindLabels()[row.kind as LeaseEventKind] ?? row.kind;
  return `${label} · ${row.title}`;
}

/**
 * FullCalendar event for a feed row. All-day rows use Tunis calendar dates (end exclusive) so the
 * day never shifts with the browser's time zone; timed rows keep their ISO instants.
 */
export function toEventInput(row: FeedRow): CalendarEventInput {
  const start = row.all_day ? todayTunis(new Date(row.starts_at)) : row.starts_at;
  const end = row.all_day ? todayTunis(new Date(row.ends_at)) : row.ends_at;
  return {
    id: row.event_id,
    title: eventTitle(row),
    start,
    end,
    allDay: row.all_day,
    classNames: [`ev-${row.source}`, `ev-${row.kind}`, `ev-status-${row.status}`],
    extendedProps: {
      source: row.source,
      kind: row.kind,
      appointmentId: row.appointment_id,
      leaseId: row.lease_id,
      unitId: row.unit_id,
      status: row.status,
    },
  };
}

/** The whole Tunis days `from` and `to` (YYYY-MM-DD, both included) as ISO instants. */
export const calendarRangeQuery = (from: string, to: string): { from: string; to: string } => ({
  from: `${from}T00:00:00+01:00`,
  to: `${to}T23:59:59+01:00`,
});
