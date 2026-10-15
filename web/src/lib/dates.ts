// Dates for leases and appointments. Tunisia is UTC+1 all year, but the browser (or the server)
// may run in another time zone: every "today" that drives lease logic goes through here.

const TUNIS = 'Africa/Tunis';

// en-CA formats as YYYY-MM-DD.
const dayInTunis = new Intl.DateTimeFormat('en-CA', {
  timeZone: TUNIS,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function todayTunis(now: Date = new Date()): string {
  return dayInTunis.format(now);
}

function toUtcMs(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(iso: string, days: number): string {
  return new Date(toUtcMs(iso) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from `fromIso` to `toIso`; negative when `toIso` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((toUtcMs(toIso) - toUtcMs(fromIso)) / 86_400_000);
}
