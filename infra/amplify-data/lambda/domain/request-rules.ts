// Pure checks for visitor requests, ported from db/migrations/0008_visitor_requests.sql.
import { addDays, isIsoDate } from './dates.ts';
import { fail } from './errors.ts';

export const REQUEST_LIMITS = {
  per_phone_per_hour: 3,
  per_org_per_10_minutes: 30,
  max_message_length: 2000,
  rental_start_max_days: 365,
  visit_max_days_ahead: 30,
} as const;

const NAME_FORBIDDEN = /[\u0000-\u001f\u007f<>‪-‮⁦-⁩]/;
const PHONE = /^[0-9 +().-]{6,25}$/;
const EMAIL = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const TIME = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const HOUR_MS = 3_600_000;
const TEN_MINUTES_MS = 600_000;

export interface ContactInput {
  full_name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
}

export interface CleanContact {
  full_name: string;
  phone: string;
  phone_digits: string;
  email: string | null;
  message: string | null;
}

export const phoneDigits = (phone: string | null | undefined): string => (phone ?? '').replace(/[^0-9]/g, '');

/** The trimmed values that get stored, or REQUEST_INVALID. */
export function cleanContact(input: ContactInput): CleanContact {
  const fullName = (input.full_name ?? '').trim();
  const phone = (input.phone ?? '').trim();
  const email = (input.email ?? '').trim() || null;
  const message = (input.message ?? '').trim() || null;
  const digits = phoneDigits(phone);
  const valid = fullName.length >= 2 && fullName.length <= 120 && !NAME_FORBIDDEN.test(fullName)
    && PHONE.test(phone) && digits.length >= 7
    && (email === null || (email.length <= 200 && EMAIL.test(email)))
    && (input.message ?? '').length <= REQUEST_LIMITS.max_message_length;
  if (!valid) fail('REQUEST_INVALID');
  return { full_name: fullName, phone, phone_digits: digits, email, message };
}

/** Rental: start from today to a year ahead, 1 to 120 months. */
export function assertRentalTerms(startDate: string, durationMonths: number, today: string): void {
  const valid = isIsoDate(startDate) && startDate >= today && startDate <= addDays(today, REQUEST_LIMITS.rental_start_max_days)
    && Number.isInteger(durationMonths) && durationMonths >= 1 && durationMonths <= 120;
  if (!valid) fail('REQUEST_INVALID');
}

/** Visit: tomorrow to 30 days ahead, Monday to Saturday, 09:00 to 17:30 on the half hour. Returns HH:MM:SS. */
export function normalizeVisitSlot(visitDate: string, visitTime: string, today: string): string {
  const time = TIME.exec(visitTime ?? '');
  const sunday = isIsoDate(visitDate) && new Date(`${visitDate}T00:00:00Z`).getUTCDay() === 0;
  const valid = isIsoDate(visitDate) && time !== null && !sunday
    && visitDate >= addDays(today, 1) && visitDate <= addDays(today, REQUEST_LIMITS.visit_max_days_ahead)
    && (time[3] ?? '00') === '00' && (time[2] === '00' || time[2] === '30')
    && `${time[1]}:${time[2]}` >= '09:00' && `${time[1]}:${time[2]}` <= '17:30';
  if (!valid) fail('REQUEST_INVALID');
  return `${time![1]}:${time![2]}:00`;
}

/** 3 requests per phone per hour, 30 per organization per 10 minutes. */
export function isThrottled(recent: { phone_digits: string; created_at: string }[], digits: string, now: Date): boolean {
  const t = now.getTime();
  const lastHourSamePhone = recent.filter((r) => r.phone_digits === digits && Date.parse(r.created_at) > t - HOUR_MS).length;
  const lastTenMinutes = recent.filter((r) => Date.parse(r.created_at) > t - TEN_MINUTES_MS).length;
  return lastHourSamePhone >= REQUEST_LIMITS.per_phone_per_hour || lastTenMinutes >= REQUEST_LIMITS.per_org_per_10_minutes;
}
