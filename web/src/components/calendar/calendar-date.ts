// Local-calendar helpers for the date picker. A yyyy-mm-dd string is a calendar day, not an instant,
// so it is read as local midnight and written back without any time-zone conversion.

/** « 2026-10-16 » → the local Date for that day (safe from the UTC shift of new Date(iso)). */
export function dateFromIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The local Date → « 2026-10-16 ». */
export function isoFromDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
