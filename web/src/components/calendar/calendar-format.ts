import { getIntlLocale } from '@/i18n/store';
import { isoToTunisParts } from '@/lib/appointments';

// Days are worded in the interface language; times stay HH:mm (24 h, Latin digits) and are shown left-to-right.

const tunisDay = (iso: string, options: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat(getIntlLocale(), { timeZone: 'Africa/Tunis', ...options }).format(new Date(iso));

/** « vendredi 16 octobre 2026 » in Tunis time. */
export const formatLongDay = (iso: string): string => tunisDay(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** « 16 oct. 2026 » in Tunis time. */
export const formatShortDay = (iso: string): string => tunisDay(iso, { day: 'numeric', month: 'short', year: 'numeric' });

/** « 09:00 » in Tunis time. */
export const formatTime = (iso: string): string => isoToTunisParts(iso).time;

export type RangeParts = {
  /** Long day of the start. */
  day: string;
  startTime: string;
  endTime: string;
  /** Short day of the end when it is not the start's day, otherwise null. */
  endDay: string | null;
};

/** The pieces of « vendredi 16 octobre 2026 · 09:00 – 10:00 », so times can be laid out left-to-right in Arabic. */
export function formatRange(startIso: string, endIso: string): RangeParts {
  const start = isoToTunisParts(startIso);
  const end = isoToTunisParts(endIso);
  return {
    day: formatLongDay(startIso),
    startTime: start.time,
    endTime: end.time,
    endDay: start.date === end.date ? null : formatShortDay(endIso),
  };
}
