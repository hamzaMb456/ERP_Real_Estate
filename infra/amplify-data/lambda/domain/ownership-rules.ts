// Pure ownership rules, ported from db/migrations/0002_core_records.sql.
import { isIsoDate, rangesOverlap } from './dates.ts';
import { fail } from './errors.ts';

export interface Ownership {
  id: string;
  organization_id: string;
  unit_id: string;
  contact_id: string;
  share_percent: number;
  starts_on: string;
  ends_on?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OwnerShare {
  contact_id: string;
  share_percent: number;
}

const OPEN_END = '9999-12-31';
const MAX_SHARE_HUNDREDTHS = 100_00;

/** numeric(5,2) shares compared in hundredths, never as floats. */
const hundredths = (share: number): number => Math.round(share * 100);

const holds = (o: Ownership, day: string): boolean => o.starts_on <= day && (o.ends_on ?? OPEN_END) >= day;

/** Column checks: share in (0, 100] with two decimals, ends_on >= starts_on. */
export function validateOwnership(o: Pick<Ownership, 'share_percent' | 'starts_on' | 'ends_on'>): void {
  const share = o.share_percent;
  const twoDecimals = typeof share === 'number' && Math.abs(share * 100 - hundredths(share)) < 1e-6;
  if (!twoDecimals || !Number.isFinite(share) || share <= 0 || share > 100) fail('ownerships_share_percent_check');
  if (!isIsoDate(o.starts_on) || (o.ends_on != null && !isIsoDate(o.ends_on))) fail('ownerships_dates_check');
  if (o.ends_on != null && o.ends_on < o.starts_on) fail('ownerships_dates_check');
}

/** ownerships_no_overlap: one contact never holds two overlapping periods on one unit. */
export function assertNoContactOverlap(rows: Ownership[]): void {
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const a = rows[i];
      const b = rows[j];
      if (a.contact_id === b.contact_id
        && rangesOverlap(a.starts_on, a.ends_on ?? OPEN_END, b.starts_on, b.ends_on ?? OPEN_END)) {
        fail('ownerships_no_overlap');
      }
    }
  }
}

/** First day the total share passes 100 %; the peak is always on some row's start date. */
export function firstDayOverCap(rows: Ownership[]): string | null {
  const days = [...new Set(rows.map((r) => r.starts_on))].sort();
  for (const day of days) {
    const total = rows.filter((r) => holds(r, day)).reduce((sum, r) => sum + hundredths(r.share_percent), 0);
    if (total > MAX_SHARE_HUNDREDTHS) return day;
  }
  return null;
}

export function assertSharesCap(rows: Ownership[]): void {
  const day = firstDayOverCap(rows);
  if (day) {
    const [y, m, d] = day.split('-');
    fail(`ownership_shares_exceeded:${d}/${m}/${y}`);
  }
}

/** current_ownerships: who holds the unit on `today`. */
export function currentOwners(rows: Ownership[], today: string): OwnerShare[] {
  return rows
    .filter((r) => holds(r, today))
    .sort((a, b) => b.share_percent - a.share_percent || a.contact_id.localeCompare(b.contact_id))
    .map((r) => ({ contact_id: r.contact_id, share_percent: r.share_percent }));
}
