import { addDays } from '@/lib/dates';
import type { CalendarViewName } from './calendar-types';

// The view and the date live in the query string (?vue=semaine&date=2026-10-16), so a reload keeps them.

const VIEW_BY_PARAM: Record<string, CalendarViewName> = {
  mois: 'dayGridMonth',
  semaine: 'timeGridWeek',
  liste: 'listWeek',
};

export const viewFromParam = (param: string | null): CalendarViewName => VIEW_BY_PARAM[param ?? ''] ?? 'dayGridMonth';

export function paramFromView(view: CalendarViewName): string {
  return Object.entries(VIEW_BY_PARAM).find(([, value]) => value === view)?.[0] ?? 'mois';
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The param when it is a real calendar day (YYYY-MM-DD), the fallback otherwise. */
export function dateFromParam(param: string | null, fallback: string): string {
  const match = ISO_DAY.exec(param ?? '');
  if (!match) return fallback;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const real = new Date(Date.UTC(year, month - 1, day));
  return real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 && real.getUTCDate() === day ? (param as string) : fallback;
}

const weekdayOf = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay();
const mondayOnOrBefore = (iso: string): string => addDays(iso, -((weekdayOf(iso) + 6) % 7));
const sundayOnOrAfter = (iso: string): string => addDays(iso, (7 - weekdayOf(iso)) % 7);

/** The Tunis days (first and last, both included) a view shows, Monday first. */
export function visibleRange(view: CalendarViewName, date: string): { from: string; to: string } {
  if (view !== 'dayGridMonth') {
    const monday = mondayOnOrBefore(date);
    return { from: monday, to: addDays(monday, 6) };
  }
  const first = `${date.slice(0, 8)}01`;
  const lastOfMonth = addDays(`${addDays(first, 32).slice(0, 8)}01`, -1);
  return { from: mondayOnOrBefore(first), to: sundayOnOrAfter(lastOfMonth) };
}
