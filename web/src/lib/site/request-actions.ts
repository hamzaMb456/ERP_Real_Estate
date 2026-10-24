'use server';

// Server actions behind the request dialogs of the public unit page. They run on the server, call the Hasura "public"
// role, and never throw: the dialog gets a result it can word. The database functions stay the authority (validation,
// throttle, notification); the checks here only refuse obvious garbage early and keep bots out through the honeypot.

import { getListingsByIds, type PublicListing } from './listings-queries';
import { clientQuery, publicQuery } from './public-api';
import {
  isValid,
  requestErrorCode,
  validateContact,
  validateRental,
  validateVisit,
  type ContactInput,
  type RequestErrorCode,
} from './request-form';

export type RequestResult = { ok: true } | { ok: false; code: RequestErrorCode };
export type TakenSlot = { date: string; time: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SUBMIT_RENTAL = `
  mutation SubmitRentalRequest($unit: uuid!, $start: date!, $months: Int!, $name: String!, $phone: String!, $email: String, $message: String) {
    submit_rental_request(args: { p_unit_id: $unit, p_start_date: $start, p_duration_months: $months, p_full_name: $name, p_phone: $phone, p_email: $email, p_message: $message }) {
      id
    }
  }
`;

const SUBMIT_VISIT = `
  mutation SubmitVisitRequest($unit: uuid!, $day: date!, $time: time!, $name: String!, $phone: String!, $email: String, $message: String) {
    submit_visit_request(args: { p_unit_id: $unit, p_visit_date: $day, p_visit_time: $time, p_full_name: $name, p_phone: $phone, p_email: $email, p_message: $message }) {
      id
    }
  }
`;

const TAKEN_SLOTS = `
  query TakenVisitSlots($unit: uuid!) {
    public_taken_visit_slots(where: { unit_id: { _eq: $unit } }, limit: 500) { visit_date visit_time }
  }
`;

type Raw = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const asRaw = (input: unknown): Raw => (typeof input === 'object' && input !== null ? (input as Raw) : {});

function contactOf(raw: Raw): ContactInput {
  return { fullName: text(raw.fullName), phone: text(raw.phone), email: text(raw.email), message: text(raw.message) };
}

const failure = (error: unknown): RequestResult => ({ ok: false, code: error instanceof Error ? requestErrorCode(error.message) : 'unknown' });

const contactVariables = (contact: ContactInput) => ({
  name: contact.fullName.trim(),
  phone: contact.phone.trim(),
  email: contact.email.trim() || null,
  message: contact.message.trim() || null,
});

/** A rental request: the unit id, a start date, a duration in months and the visitor's contact. */
export async function submitRentalRequestAction(input: unknown): Promise<RequestResult> {
  const raw = asRaw(input);
  // Honeypot: a field no visitor sees. A bot that fills it is told it worked, and nothing is stored.
  if (text(raw.website) !== '') return { ok: true };
  const unitId = text(raw.unitId);
  const months = typeof raw.months === 'number' ? raw.months : Number.NaN;
  const startDate = text(raw.startDate);
  const contact = contactOf(raw);
  // The client's JWT, forwarded so the DB function can verify the visitor is logged in.
  const accessToken = text(raw.accessToken) || null;
  if (!UUID.test(unitId) || !isValid(validateContact(contact)) || !isValid(validateRental({ startDate, months }))) {
    return { ok: false, code: 'invalid' };
  }
  try {
    const vars = { unit: unitId, start: startDate, months, ...contactVariables(contact) };
    await (accessToken ? clientQuery(accessToken, SUBMIT_RENTAL, vars) : publicQuery(SUBMIT_RENTAL, vars));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** A visit request: the unit id, a day, a half-hour slot and the visitor's contact. */
export async function submitVisitRequestAction(input: unknown): Promise<RequestResult> {
  const raw = asRaw(input);
  if (text(raw.website) !== '') return { ok: true };
  const unitId = text(raw.unitId);
  const contact = contactOf(raw);
  const choice = { date: text(raw.date), time: text(raw.time) };
  const accessToken = text(raw.accessToken) || null;
  if (!UUID.test(unitId) || !isValid(validateContact(contact)) || !isValid(validateVisit(choice))) {
    return { ok: false, code: 'invalid' };
  }
  try {
    const vars = { unit: unitId, day: choice.date, time: choice.time, ...contactVariables(contact) };
    await (accessToken ? clientQuery(accessToken, SUBMIT_VISIT, vars) : publicQuery(SUBMIT_VISIT, vars));
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** The slots already confirmed for a unit (so the dialog greys them out). Empty when the backend cannot be reached. */
export async function takenVisitSlotsAction(unitId: string): Promise<TakenSlot[]> {
  if (!UUID.test(unitId)) return [];
  try {
    const data = await publicQuery<{ public_taken_visit_slots: { visit_date: string; visit_time: string }[] }>(TAKEN_SLOTS, { unit: unitId });
    return data.public_taken_visit_slots.map((slot) => ({ date: slot.visit_date, time: slot.visit_time.slice(0, 5) }));
  } catch (error) {
    console.error('[public-requests] taken slots failed', error);
    return [];
  }
}

/** The listings behind the visitor's favorites (ids come from the browser: only valid, published ones come back). */
export async function favoriteListingsAction(ids: unknown): Promise<PublicListing[]> {
  if (!Array.isArray(ids)) return [];
  // Normalised here, outside the cache: the cache key is the argument, so junk or reordered ids must not mint new keys.
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === 'string' && UUID.test(id)))].slice(0, 100);
  return wanted.length === 0 ? [] : getListingsByIds(wanted);
}
