// Dates are ISO `YYYY-MM-DD` strings (they compare correctly as strings).

const TUNIS_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Tunis',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "Today" is always Tunisia, as in the SQL today_tunis(). */
export function todayTunis(now: Date = new Date()): string {
  return TUNIS_DAY.format(now);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** The Tunis calendar day of an instant (timestamptz at time zone 'Africa/Tunis')::date. */
export function tunisDayOf(instant: string): string {
  return todayTunis(new Date(instant));
}

export function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

export function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Inclusive ranges, like daterange(a, b, '[]') && daterange(c, d, '[]'). */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}
