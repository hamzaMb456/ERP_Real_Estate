import 'server-only';

import { cacheLife } from 'next/cache';
import { siteConfig } from './config';
import { publicQuery } from './public-api';
import type { SearchFilters, SearchMode } from './search-params';

// Reads of the public views (public_listings, public_listing_photos) as the Hasura "public" role. Three rules:
// - every query filters on the one organization the site serves, and on offerable units (one shared `where` helper);
// - user input only ever travels as GraphQL variables, the query texts below are constants;
// - the exported functions are cached ('use cache', a few minutes) and never throw: a missing backend, role or
//   organization id is logged and answered with an empty result (null for getListing), so pages build and render
//   without a backend.

export const PAGE_SIZE = 12;

/**
 * Unit statuses that are not on offer. The view already hides archived units; a sold unit or one under maintenance
 * can still have a published listing until staff close it, and must not show up.
 */
export const EXCLUDED_UNIT_STATUSES = ['sold', 'under_maintenance'] as const;

export type PublicUnitType = 'apartment' | 'office' | 'shop' | 'parking' | 'house' | 'land';

export type PublicListing = {
  id: string;
  organizationId: string;
  unitId: string;
  kind: SearchMode;
  title: string;
  description: string | null;
  /** Monthly rent or sale price in TND (the where helper drops rows without a price). */
  price: number;
  charges: number | null;
  depositMonths: number;
  reservationDeposit: number;
  reservationDays: number;
  /** YYYY-MM-DD */
  availableFrom: string | null;
  furnished: boolean;
  amenities: string[];
  virtualTourUrl: string | null;
  publishedAt: string | null;
  unitType: PublicUnitType;
  rooms: number | null;
  surfaceM2: number | null;
  floor: number | null;
  unitStatus: string;
  /** The bien's city; null when staff left it empty (such a listing still shows, it just has no city). */
  city: string | null;
  governorate: string | null;
  /** Rounded to 3 decimals by the view: the exact address is not public. */
  latitude: number | null;
  longitude: number | null;
  coverFileId: string | null;
  photoCount: number;
  /** Only loaded by getListing, in display order. */
  photos?: { storageFileId: string; position: number }[];
};

type NumberLike = number | string | null | undefined;

/** A row of public_listings as Hasura returns it (snake_case, numerics as numbers or strings). */
export type ListingRow = {
  id: string;
  organization_id: string;
  unit_id: string;
  kind: SearchMode;
  title: string;
  description: string | null;
  price: NumberLike;
  charges: NumberLike;
  deposit_months: NumberLike;
  reservation_deposit: NumberLike;
  reservation_days: NumberLike;
  available_from: string | null;
  furnished: boolean;
  amenities: string[] | null;
  virtual_tour_url: string | null;
  published_at: string | null;
  unit_type: PublicUnitType;
  rooms: NumberLike;
  surface_m2: NumberLike;
  floor: NumberLike;
  unit_status: string;
  city: string | null;
  governorate: string | null;
  latitude: NumberLike;
  longitude: NumberLike;
  cover_file_id: string | null;
  photo_count: NumberLike;
  photos?: { storage_file_id: string; position: number }[];
};

/** Hasura sends numeric columns as numbers or as strings depending on its settings. */
function toNumber(value: NumberLike): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toPublicListing(row: ListingRow): PublicListing {
  const listing: PublicListing = {
    id: row.id,
    organizationId: row.organization_id,
    unitId: row.unit_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    price: toNumber(row.price) ?? 0,
    charges: toNumber(row.charges),
    depositMonths: toNumber(row.deposit_months) ?? 0,
    reservationDeposit: toNumber(row.reservation_deposit) ?? 0,
    reservationDays: toNumber(row.reservation_days) ?? 0,
    availableFrom: row.available_from,
    furnished: row.furnished,
    amenities: row.amenities ?? [],
    virtualTourUrl: row.virtual_tour_url,
    publishedAt: row.published_at,
    unitType: row.unit_type,
    rooms: toNumber(row.rooms),
    surfaceM2: toNumber(row.surface_m2),
    floor: toNumber(row.floor),
    unitStatus: row.unit_status,
    city: row.city,
    governorate: row.governorate,
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    coverFileId: row.cover_file_id,
    photoCount: toNumber(row.photo_count) ?? 0,
  };
  if (row.photos) {
    listing.photos = row.photos.map((photo) => ({ storageFileId: photo.storage_file_id, position: photo.position }));
  }
  return listing;
}

type Where = Record<string, unknown>;

/** `where` restricted to listings that have a city: what the city list and the city count are built on. */
export function withCity(where: Where): Where {
  return { _and: [...(where as { _and: Where[] })._and, { city: { _is_null: false } }] };
}

/**
 * The one `where` every public query starts from: my organization, a real price, a unit that is on offer, the
 * requested kind (all kinds when `mode` is omitted), then the user's filters.
 */
export function listingsWhere(mode?: SearchMode, filters?: SearchFilters): Where {
  const and: Where[] = [
    { organization_id: { _eq: siteConfig.orgId } },
    { price: { _is_null: false } },
    { unit_status: { _nin: [...EXCLUDED_UNIT_STATUSES] } },
  ];
  if (mode) and.push({ kind: { _eq: mode } });
  if (filters) {
    if (filters.cities.length) and.push({ city: { _in: filters.cities } });
    if (filters.types.length) and.push({ unit_type: { _in: filters.types } });
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      const price: Record<string, number> = {};
      if (filters.priceMin !== undefined) price._gte = filters.priceMin;
      if (filters.priceMax !== undefined) price._lte = filters.priceMax;
      and.push({ price });
    }
    if (filters.roomsMin !== undefined) and.push({ rooms: { _gte: filters.roomsMin } });
    if (filters.surfaceMin !== undefined) and.push({ surface_m2: { _gte: filters.surfaceMin } });
    if (filters.furnished) and.push({ furnished: { _eq: true } });
    if (filters.availableFrom !== undefined) {
      and.push({ _or: [{ available_from: { _is_null: true } }, { available_from: { _lte: filters.availableFrom } }] });
    }
  }
  return { _and: and };
}

const LISTING_FIELDS = `
  id organization_id unit_id kind title description price charges deposit_months reservation_deposit
  reservation_days available_from furnished amenities virtual_tour_url published_at unit_type rooms surface_m2
  floor unit_status city governorate latitude longitude cover_file_id photo_count
`;

const LATEST_QUERY = `
  query PublicLatestListings($where: public_listings_bool_exp!, $orderBy: [public_listings_order_by!]!, $limit: Int!) {
    listings: public_listings(where: $where, order_by: $orderBy, limit: $limit) { ${LISTING_FIELDS} }
  }
`;

const SEARCH_QUERY = `
  query PublicSearchListings(
    $where: public_listings_bool_exp!
    $citiesWhere: public_listings_bool_exp!
    $orderBy: [public_listings_order_by!]!
    $limit: Int!
    $offset: Int!
  ) {
    items: public_listings(where: $where, order_by: $orderBy, limit: $limit, offset: $offset) { ${LISTING_FIELDS} }
    total: public_listings_aggregate(where: $where) { aggregate { count } }
    cities: public_listings(where: $citiesWhere, distinct_on: city, order_by: { city: asc }) { city }
  }
`;

const ONE_QUERY = `
  query PublicListing($where: public_listings_bool_exp!, $limit: Int!) {
    listings: public_listings(where: $where, limit: $limit) {
      ${LISTING_FIELDS}
      photos(order_by: { position: asc }) { storage_file_id position }
    }
  }
`;

const COUNT_QUERY = `
  query PublicCountListings($where: public_listings_bool_exp!, $citiesWhere: public_listings_bool_exp!) {
    total: public_listings_aggregate(where: $where) { aggregate { count } }
    cities: public_listings(where: $citiesWhere, distinct_on: city, order_by: { city: asc }) { city }
  }
`;

const RECENT_FIRST = { published_at: 'desc_nulls_last' } as const;
const TIE_BREAK = { id: 'asc' } as const;
const MAX_LATEST = 50;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function orderBy(sort: SearchFilters['sort']): Record<string, string>[] {
  if (sort === 'price_asc') return [{ price: 'asc' }, RECENT_FIRST, TIE_BREAK];
  if (sort === 'price_desc') return [{ price: 'desc' }, RECENT_FIRST, TIE_BREAK];
  return [RECENT_FIRST, TIE_BREAK];
}

type SearchResult = { items: PublicListing[]; total: number; cities: string[] };
type CountResult = { total: number; cities: number };

/**
 * Runs a read and never throws. A missing organization id, backend, role or view is logged server side and answered
 * with the empty value. This must happen INSIDE the cached functions: Next fails a prerender for any error that
 * escapes a "use cache" scope, even when the caller catches it, so a backend that is not set up would break the build.
 * (The empty answer is cached like any other, for at most the cacheLife below.)
 */
async function safely<T>(name: string, empty: () => T, run: () => Promise<T>): Promise<T> {
  if (!siteConfig.orgId) {
    console.error(`[public-listings] ${name} skipped: NEXT_PUBLIC_AGENCY_ORG_ID is not set`);
    return empty();
  }
  try {
    return await run();
  } catch (err) {
    console.error(`[public-listings] ${name} failed`, err);
    return empty();
  }
}

/** The most recently published listings of a mode (at most 50). */
export async function getLatestListings(mode: SearchMode, limit: number): Promise<PublicListing[]> {
  'use cache';
  cacheLife('minutes');
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 1, 1), MAX_LATEST);
  return safely('getLatestListings', () => [], async () => {
    const data = await publicQuery<{ listings: ListingRow[] }>(LATEST_QUERY, {
      where: listingsWhere(mode),
      orderBy: [RECENT_FIRST, TIE_BREAK],
      limit: safeLimit,
    });
    return data.listings.map(toPublicListing);
  });
}

/** One page (PAGE_SIZE) of listings matching the filters, the total count, and the cities offered in this mode. */
export async function searchListings(mode: SearchMode, filters: SearchFilters): Promise<SearchResult> {
  'use cache';
  cacheLife('minutes');
  return safely('searchListings', () => ({ items: [], total: 0, cities: [] }), async () => {
    const data = await publicQuery<{
      items: ListingRow[];
      total: { aggregate: { count: number } | null };
      cities: { city: string }[];
    }>(SEARCH_QUERY, {
      where: listingsWhere(mode, filters),
      citiesWhere: withCity(listingsWhere(mode)),
      orderBy: orderBy(filters.sort),
      limit: PAGE_SIZE,
      offset: (filters.page - 1) * PAGE_SIZE,
    });
    return {
      items: data.items.map(toPublicListing),
      total: data.total.aggregate?.count ?? 0,
      cities: data.cities.map((entry) => entry.city),
    };
  });
}

/** A published listing of this organization with its photos, or null (absent, unpublished, other organization, failure). */
export async function getListing(id: string): Promise<PublicListing | null> {
  'use cache';
  cacheLife('minutes');
  if (!UUID_PATTERN.test(id)) return null;
  return safely<PublicListing | null>('getListing', () => null, async () => {
    const data = await publicQuery<{ listings: ListingRow[] }>(ONE_QUERY, {
      where: { _and: [{ id: { _eq: id } }, ...(listingsWhere() as { _and: Where[] })._and] },
      limit: 1,
    });
    const row = data.listings[0];
    return row ? toPublicListing(row) : null;
  });
}

/** How many listings are published (both modes) and in how many cities. */
export async function countPublished(): Promise<CountResult> {
  'use cache';
  cacheLife('minutes');
  return safely('countPublished', () => ({ total: 0, cities: 0 }), async () => {
    const data = await publicQuery<{
      total: { aggregate: { count: number } | null };
      cities: { city: string }[];
    }>(COUNT_QUERY, { where: listingsWhere(), citiesWhere: withCity(listingsWhere()) });
    return { total: data.total.aggregate?.count ?? 0, cities: data.cities.length };
  });
}

const CITIES_QUERY = `
  query PublicCities($where: public_listings_bool_exp!) {
    cities: public_listings(where: $where, distinct_on: city, order_by: { city: asc }) { city }
  }
`;

/** The cities (alphabetical) that have at least one published listing, for the home page search. */
export async function getPublishedCities(): Promise<string[]> {
  'use cache';
  cacheLife('minutes');
  return safely('getPublishedCities', () => [], async () => {
    const data = await publicQuery<{ cities: { city: string }[] }>(CITIES_QUERY, {
      where: withCity(listingsWhere()),
    });
    return data.cities.map((entry) => entry.city);
  });
}
