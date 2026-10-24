// The public website (was the public_listings / public_taken_visit_slots views and the submit_* functions).
import type { Item } from '../../domain/db.ts';
import { batchGet, getItem, queryAll } from '../../domain/db.ts';
import { fail } from '../../domain/errors.ts';
import { submitRentalRequest, submitVisitRequest } from '../../domain/requests.ts';
import type { OrderBy, Where } from '../hasura-eval.ts';
import { aggregate, distinctOn, eqValue, matches, page, sortRows } from '../hasura-eval.ts';
import type { Op, Vars } from '../registry.ts';
import { ANYONE, CLIENT, mutation, query } from '../registry.ts';

const MAX_TAKEN_SLOTS = 500;
const CITY_ORDER = { city: 'asc' };

/** Public reads are always about one organization: the site's, named in the where. */
async function listingsOf(where: Where): Promise<Item[]> {
  const orgId = eqValue(where, 'organization_id');
  if (typeof orgId !== 'string') fail('public_org_required');
  return queryAll('PublicListing', { index: 'byOrg', key: 'organization_id', value: orgId });
}

async function select(vars: Vars): Promise<Item[]> {
  const where = vars.where as Where;
  const rows = (await listingsOf(where)).filter((r) => matches(r, where));
  return page(sortRows(rows, vars.orderBy as OrderBy), vars.limit as number, vars.offset as number);
}

async function cities(where: Where): Promise<{ city: string }[]> {
  const rows = (await listingsOf(where)).filter((r) => matches(r, where));
  return distinctOn(sortRows(rows, CITY_ORDER), 'city').map((r) => ({ city: r.city as string }));
}

async function count(where: Where): Promise<number> {
  return (await listingsOf(where)).filter((r) => matches(r, where)).length;
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const optional = (v: unknown): string | null => (typeof v === 'string' ? v : null);

export const publicOps: Record<string, Op> = {
  PublicLatestListings: query(ANYONE, async (_c, v) => ({ listings: await select(v) })),
  PublicListing: query(ANYONE, async (_c, v) => ({ listings: await select(v) })),
  PublicListingsByIds: query(ANYONE, async (_c, v) => ({ listings: await select(v) })),
  PublicSearchListings: query(ANYONE, async (_c, v) => ({
    items: await select(v),
    total: aggregate(await count(v.where as Where)),
    cities: await cities(v.citiesWhere as Where),
  })),
  PublicCountListings: query(ANYONE, async (_c, v) => ({
    total: aggregate(await count(v.where as Where)),
    cities: await cities(v.citiesWhere as Where),
  })),
  PublicCities: query(ANYONE, async (_c, v) => ({ cities: await cities(v.where as Where) })),

  /** Confirmed visit slots of a unit that is on the website; no names, no phones. */
  TakenVisitSlots: query(ANYONE, async (_c, v) => {
    const unitId = text(v.unit);
    if (!(await getItem('PublicListing', { id: unitId }))) return { public_taken_visit_slots: [] };
    const visits = await queryAll('VisitRequest', { index: 'byUnit', key: 'unit_id', value: unitId });
    return {
      public_taken_visit_slots: visits
        .filter((r) => r.status === 'confirmed')
        .slice(0, MAX_TAKEN_SLOTS)
        .map((r) => ({ visit_date: r.visit_date, visit_time: r.visit_time })),
    };
  }),

  SubmitRentalRequest: mutation(['public', 'user'], async (caller, v) => {
    const receipt = await submitRentalRequest(caller, {
      unit_id: text(v.unit), start_date: text(v.start), duration_months: Number(v.months),
      full_name: text(v.name), phone: text(v.phone), email: optional(v.email), message: optional(v.message),
    });
    return { submit_rental_request: [{ id: receipt.id }] };
  }),
  SubmitVisitRequest: mutation(['public', 'user'], async (caller, v) => {
    const receipt = await submitVisitRequest(caller, {
      unit_id: text(v.unit), visit_date: text(v.day), visit_time: text(v.time),
      full_name: text(v.name), phone: text(v.phone), email: optional(v.email), message: optional(v.message),
    });
    return { submit_visit_request: [{ id: receipt.id }] };
  }),

  /** The signed-in client's own visit requests, newest first. */
  MyVisits: query(CLIENT, async (caller) => {
    const rows = await queryAll('VisitRequest', { index: 'byClient', key: 'client_user_id', value: caller.userId });
    return {
      visit_requests: sortRows(rows, { created_at: 'desc' }).map((r) => ({
        id: r.id, unit_id: r.unit_id, visit_date: r.visit_date, visit_time: r.visit_time, status: r.status, created_at: r.created_at,
      })),
    };
  }),
  ListingsFor: query(CLIENT, async (_c, v) => {
    const rows = await batchGet('PublicListing', (Array.isArray(v.ids) ? v.ids : []).map(String));
    return { public_listings: rows.map((r) => ({ unit_id: r.unit_id, title: r.title, city: r.city, visit_payment_method: r.visit_payment_method })) };
  }),
};
