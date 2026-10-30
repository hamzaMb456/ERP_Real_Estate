// Requests sent by visitors of the public site (migration 0008): rental requests and visit requests, answered in the ERP.

import { tunisToIso } from '@/lib/appointments';

export const RENTAL_STATUSES = ['new', 'contacted', 'accepted', 'declined', 'closed'] as const;
export const VISIT_STATUSES = ['new', 'confirmed', 'declined', 'done', 'cancelled'] as const;
export type RentalStatus = (typeof RENTAL_STATUSES)[number];
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** The unit a request is about, as the ERP lists load it. */
export type RequestUnit = {
  id: string;
  code: string;
  title: string | null;
  /** Only sent for visit requests; rental requests leave it undefined. */
  visit_fee?: number | null;
  property: { id: string; name: string; city: string | null };
};

export type RequestBase = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  message: string | null;
  staff_note: string | null;
  created_at: string;
  unit: RequestUnit;
};

export type RentalRequest = RequestBase & {
  start_date: string;
  duration_months: number;
  status: RentalStatus;
  /** How a closed request ended; only set once it is closed. */
  closed_outcome?: 'accepted' | 'rejected' | null;
};

/** What the client and the staff bar show: only three states, however many steps the staff go through. */
export type RentalProgress = 'pending' | 'accepted' | 'rejected';

/** new and contacted are still pending; a closed request shows how it ended (a refusal when that is unknown). */
export function rentalProgress(status: RentalStatus, closedOutcome?: string | null): RentalProgress {
  if (status === 'accepted') return 'accepted';
  if (status === 'declined') return 'rejected';
  if (status === 'closed') return closedOutcome === 'accepted' ? 'accepted' : 'rejected';
  return 'pending';
}

export type VisitRequest = RequestBase & {
  visit_date: string;
  /** « HH:MM:SS » as Postgres returns a time. */
  visit_time: string;
  status: VisitStatus;
  appointment_id: string | null;
};

/** A visit lasts half an hour: the slots of the public form are half-hour slots. */
export const VISIT_MINUTES = 30;

/** « 10:30:00 » → « 10:30 ». */
export const shortTime = (time: string): string => time.slice(0, 5);

/** The appointment window of a visit: its slot, in Tunisia time, for half an hour. */
export function visitWindow(date: string, time: string): { startsAt: string; endsAt: string } {
  const startsAt = tunisToIso(date, shortTime(time));
  return { startsAt, endsAt: new Date(Date.parse(startsAt) + VISIT_MINUTES * 60_000).toISOString() };
}

/** « B-102 · Les Jardins de Carthage » (the unit's own title does not help staff find the record). */
export const requestUnitHeading = (unit: RequestUnit): string => `${unit.code} · ${unit.property.name}`;

/** Free-text search over the visitor's name, phone and e-mail and the unit's reference, bien and city. */
export function matchesRequest(request: RequestBase, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === '') return true;
  const phoneDigits = needle.replace(/\D/g, '');
  const haystack = [request.full_name, request.email, request.unit.code, request.unit.property.name, request.unit.property.city];
  return (
    haystack.some((value) => (value ?? '').toLowerCase().includes(needle)) ||
    (phoneDigits.length > 0 && request.phone.replace(/\D/g, '').includes(phoneDigits))
  );
}

/** A `tel:` link of a phone number as typed by a visitor (spaces and punctuation dropped, a leading + kept). */
export function telLink(phone: string): string {
  const trimmed = phone.trim();
  return 'tel:' + (trimmed.startsWith('+') ? '+' : '') + trimmed.replace(/\D/g, '');
}

/** Newest first: the order the lists show. */
export const newestFirst = <T extends { created_at: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
