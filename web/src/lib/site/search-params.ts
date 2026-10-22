// Search filters of the public listing pages <-> URL query string. The URL is hostile input: every value is checked,
// clamped or dropped, and the result only ever travels as GraphQL variables.

export type SearchMode = 'rent' | 'sale';
export type SearchUnitType = 'apartment' | 'office' | 'shop' | 'parking';
export type SearchSort = 'recent' | 'price_asc' | 'price_desc';

export type SearchFilters = {
  cities: string[];
  types: SearchUnitType[];
  priceMin?: number;
  priceMax?: number;
  roomsMin?: number;
  surfaceMin?: number;
  furnished?: boolean;
  /** YYYY-MM-DD */
  availableFrom?: string;
  sort: SearchSort;
  page: number;
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const SEARCH_UNIT_TYPES: readonly SearchUnitType[] = ['apartment', 'office', 'shop', 'parking'];
export const SEARCH_SORTS: readonly SearchSort[] = ['recent', 'price_asc', 'price_desc'];

const MAX_CITIES = 10;
const MAX_CITY_LENGTH = 60;
const MAX_PAGE = 500;
const MAX_ROOMS = 10;
const MAX_AMOUNT = 1_000_000_000;
const NUMBER_PATTERN = /^\d+(\.\d+)?$/;
const INTEGER_PATTERN = /^\d+$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function all(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function first(value: string | string[] | undefined): string | undefined {
  return all(value)[0]?.trim();
}

/** A finite, non-negative decimal written plainly (no sign, no exponent), clamped to a ceiling. */
function amount(value: string | string[] | undefined): number | undefined {
  const text = first(value);
  if (!text || !NUMBER_PATTERN.test(text)) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? Math.min(parsed, MAX_AMOUNT) : undefined;
}

function parseDate(value: string | string[] | undefined): string | undefined {
  const text = first(value);
  const match = text ? DATE_PATTERN.exec(text) : null;
  if (!text || !match) return undefined;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return real ? text : undefined;
}

function parseCities(value: string | string[] | undefined): string[] {
  const cities: string[] = [];
  for (const raw of all(value)) {
    const city = raw.trim().slice(0, MAX_CITY_LENGTH).trim();
    if (city && !cities.includes(city)) cities.push(city);
    if (cities.length === MAX_CITIES) break;
  }
  return cities;
}

function parseTypes(value: string | string[] | undefined): SearchUnitType[] {
  const types: SearchUnitType[] = [];
  for (const raw of all(value)) {
    const type = SEARCH_UNIT_TYPES.find((allowed) => allowed === raw.trim());
    if (type && !types.includes(type)) types.push(type);
  }
  return types;
}

export function parseSearchParams(params: RawSearchParams): SearchFilters {
  const rooms = amount(params.pieces);
  const pageText = first(params.page);
  const page = pageText && INTEGER_PATTERN.test(pageText) ? Math.min(Math.max(Number(pageText), 1), MAX_PAGE) : 1;
  const sort = SEARCH_SORTS.find((allowed) => allowed === first(params.tri)) ?? 'recent';

  const filters: SearchFilters = { cities: parseCities(params.ville), types: parseTypes(params.type), sort, page };
  const priceMin = amount(params.prix_min);
  const priceMax = amount(params.prix_max);
  const surfaceMin = amount(params.surface_min);
  const availableFrom = parseDate(params.dispo);
  if (priceMin !== undefined) filters.priceMin = priceMin;
  if (priceMax !== undefined) filters.priceMax = priceMax;
  if (rooms !== undefined) filters.roomsMin = Math.min(Math.max(Math.trunc(rooms), 1), MAX_ROOMS);
  if (surfaceMin !== undefined) filters.surfaceMin = surfaceMin;
  if (first(params.meuble) === '1') filters.furnished = true;
  if (availableFrom !== undefined) filters.availableFrom = availableFrom;
  return filters;
}

/** Query string for the filters, without a leading "?" (callers add it when non-empty). Defaults are left out. */
export function toQueryString(filters: SearchFilters): string {
  const query = new URLSearchParams();
  for (const city of filters.cities) query.append('ville', city);
  for (const type of filters.types) query.append('type', type);
  if (filters.priceMin !== undefined) query.set('prix_min', String(filters.priceMin));
  if (filters.priceMax !== undefined) query.set('prix_max', String(filters.priceMax));
  if (filters.roomsMin !== undefined) query.set('pieces', String(filters.roomsMin));
  if (filters.surfaceMin !== undefined) query.set('surface_min', String(filters.surfaceMin));
  if (filters.furnished) query.set('meuble', '1');
  if (filters.availableFrom !== undefined) query.set('dispo', filters.availableFrom);
  if (filters.sort !== 'recent') query.set('tri', filters.sort);
  if (filters.page > 1) query.set('page', String(filters.page));
  return query.toString();
}
