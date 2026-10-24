// What a visitor may ask for on a unit page, and the rules a request must meet. These mirror the checks of the database
// functions submit_rental_request / submit_visit_request (migration 0008), which stay the authority: the dialog uses
// them to guide the visitor, the server action uses them to refuse early, the database refuses anything that slips by.

import { addDays, todayTunis } from '@/lib/dates';

export const RENT_DURATIONS = [3, 6, 12, 24, 36] as const;
export const MIN_RENT_MONTHS = 1;
export const MAX_RENT_MONTHS = 120;
/** A rental can start from today up to a year ahead. */
export const RENT_HORIZON_DAYS = 365;
/** A visit can be asked from tomorrow up to a month ahead. */
export const VISIT_HORIZON_DAYS = 30;
const FIRST_SLOT_MINUTES = 9 * 60;
const LAST_SLOT_MINUTES = 17 * 60 + 30;
const SLOT_STEP_MINUTES = 30;

const pad = (value: number): string => String(value).padStart(2, '0');

/** « 09:00 », « 09:30 » … « 17:30 ». */
export const VISIT_SLOTS: readonly string[] = Array.from(
  { length: (LAST_SLOT_MINUTES - FIRST_SLOT_MINUTES) / SLOT_STEP_MINUTES + 1 },
  (_, index) => {
    const minutes = FIRST_SLOT_MINUTES + index * SLOT_STEP_MINUTES;
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  },
);

const isRealDate = (iso: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) && !Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) && new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso;

/** The agency does not visit on Sundays. */
export const isSunday = (iso: string): boolean => new Date(`${iso}T00:00:00Z`).getUTCDay() === 0;

/** The days a visit can be asked for: tomorrow to 30 days ahead, Sundays left out. */
export function visitDays(today: string = todayTunis()): string[] {
  return Array.from({ length: VISIT_HORIZON_DAYS }, (_, index) => addDays(today, index + 1)).filter((day) => !isSunday(day));
}

/** The answer of the server to a request, as a code the dialog words in the visitor's language. */
export type RequestErrorCode = 'unavailable' | 'invalid' | 'not_for_rent' | 'too_many' | 'slot_taken' | 'duplicate' | 'login_required' | 'unknown';

const CODES: [string, RequestErrorCode][] = [
  ['REQUEST_UNIT_UNAVAILABLE', 'unavailable'],
  ['REQUEST_NOT_FOR_RENT', 'not_for_rent'],
  ['REQUEST_TOO_MANY', 'too_many'],
  ['REQUEST_SLOT_TAKEN', 'slot_taken'],
  ['REQUEST_DUPLICATE', 'duplicate'],
  ['REQUEST_INVALID', 'invalid'],
  ['REQUEST_LOGIN_REQUIRED', 'login_required'],
];

/** The code carried by a database error message (anything else is « unknown »). */
export function requestErrorCode(message: string): RequestErrorCode {
  return CODES.find(([needle]) => message.includes(needle))?.[1] ?? 'unknown';
}

export type ContactInput = { fullName: string; phone: string; email: string; message: string };
export type ContactField = keyof ContactInput;
export type FieldProblem = 'required' | 'invalid';
export type ContactErrors = Partial<Record<ContactField, FieldProblem>>;

const NAME_FORBIDDEN = /[\u0000-\u001f\u007f<>‪-‮⁦-⁩]/;
const PHONE_FORMAT = /^[0-9 +().-]{6,25}$/;
const EMAIL_FORMAT = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const MIN_PHONE_DIGITS = 7;
const MAX_MESSAGE = 2000;

/** The visitor's name, phone, optional e-mail and optional message. */
export function validateContact(input: ContactInput): ContactErrors {
  const errors: ContactErrors = {};
  const name = input.fullName.trim();
  const phone = input.phone.trim();
  const email = input.email.trim();
  if (name === '') errors.fullName = 'required';
  else if (name.length < 2 || name.length > 120 || NAME_FORBIDDEN.test(name)) errors.fullName = 'invalid';
  if (phone === '') errors.phone = 'required';
  else if (!PHONE_FORMAT.test(phone) || phone.replace(/\D/g, '').length < MIN_PHONE_DIGITS) errors.phone = 'invalid';
  if (email !== '' && (email.length > 200 || !EMAIL_FORMAT.test(email))) errors.email = 'invalid';
  if (input.message.length > MAX_MESSAGE) errors.message = 'invalid';
  return errors;
}

export type RentalChoice = { startDate: string; months: number };
export type RentalErrors = Partial<Record<keyof RentalChoice, FieldProblem>>;

/** A start date from today to a year ahead, and a duration of 1 to 120 whole months. */
export function validateRental(choice: RentalChoice, today: string = todayTunis()): RentalErrors {
  const errors: RentalErrors = {};
  if (choice.startDate === '') errors.startDate = 'required';
  else if (!isRealDate(choice.startDate) || choice.startDate < today || choice.startDate > addDays(today, RENT_HORIZON_DAYS)) {
    errors.startDate = 'invalid';
  }
  if (!Number.isInteger(choice.months) || choice.months < MIN_RENT_MONTHS || choice.months > MAX_RENT_MONTHS) errors.months = 'invalid';
  return errors;
}

export type VisitChoice = { date: string; time: string };
export type VisitErrors = Partial<Record<keyof VisitChoice, FieldProblem>>;

/** A day among the bookable ones and a half-hour slot between 09:00 and 17:30. */
export function validateVisit(choice: VisitChoice, today: string = todayTunis()): VisitErrors {
  const errors: VisitErrors = {};
  if (choice.date === '') errors.date = 'required';
  else if (!visitDays(today).includes(choice.date)) errors.date = 'invalid';
  if (choice.time === '') errors.time = 'required';
  else if (!VISIT_SLOTS.includes(choice.time)) errors.time = 'invalid';
  return errors;
}

/** True when nothing is wrong. */
export const isValid = (errors: object): boolean => Object.keys(errors).length === 0;
