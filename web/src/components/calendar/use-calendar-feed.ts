'use client';

import { useState } from 'react';
import type { FeedRow } from '@/lib/appointment-types';
import { calendarRangeQuery } from '@/lib/calendar';
import { useGraphql, type QueryState } from '@/lib/use-graphql';

export const FEED_COLUMNS =
  'event_id organization_id source kind title starts_at ends_at all_day status appointment_id lease_id unit_id branch_id assigned_user_id contact_ids location notify_by_email';

const FEED_QUERY = `
  query CalendarFeed($from: timestamptz!, $to: timestamptz!) {
    calendar_feed(where: { starts_at: { _lte: $to }, ends_at: { _gte: $from } }, order_by: [{ starts_at: asc }], limit: 1000) {
      ${FEED_COLUMNS}
    }
  }
`;

type RawFeedRow = Omit<FeedRow, 'contact_ids'> & { contact_ids: string[] | string | null };

/** The feed may send uuid[] as a JSON array; a Postgres array literal ("{a,b}") is accepted too. */
function toContactIds(value: string[] | string | null): string[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  return value.replace(/[{}"]/g, '').split(',').filter(Boolean);
}

export const normalizeFeedRow = (row: RawFeedRow): FeedRow => ({ ...row, contact_ids: toContactIds(row.contact_ids) });

/**
 * The calendar_feed rows that overlap the visible days. The previous rows stay in place while the
 * next range loads, so the grid does not blink empty when the user navigates.
 */
export function useCalendarFeed(range: { from: string; to: string }, reloadKey: number) {
  const result = useGraphql<{ calendar_feed: RawFeedRow[] }>(FEED_QUERY, calendarRangeQuery(range.from, range.to), reloadKey);
  const [kept, setKept] = useState<{ source: unknown; rows: FeedRow[] }>({ source: null, rows: [] });
  if (result.status === 'success' && kept.source !== result.data) {
    setKept({ source: result.data, rows: result.data.calendar_feed.map(normalizeFeedRow) });
  }
  return {
    rows: kept.rows,
    loading: result.status === 'loading',
    error: result.status === 'error' ? result.message : null,
  };
}

const FEED_ROWS_QUERY = `
  query CalendarFeedRows($where: calendar_feed_bool_exp!) {
    calendar_feed(where: $where, order_by: [{ starts_at: desc }], limit: 500) {
      ${FEED_COLUMNS}
    }
  }
`;

/** Feed rows chosen by a row filter (a lease's appointments, a year around today, ...), newest first. */
export function useFeedRows(where: Record<string, unknown>, reloadKey = 0): QueryState<FeedRow[]> {
  const result = useGraphql<{ calendar_feed: RawFeedRow[] }>(FEED_ROWS_QUERY, { where }, reloadKey);
  return result.status === 'success' ? { status: 'success', data: result.data.calendar_feed.map(normalizeFeedRow) } : result;
}
