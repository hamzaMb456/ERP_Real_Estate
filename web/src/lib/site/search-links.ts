// Links of the public search pages: every href is built from a SearchFilters value through toQueryString, so the URL
// grammar (and the clamping of hostile input) stays in one place. Pure functions, usable from server and client.
import { toQueryString, type RawSearchParams, type SearchFilters, type SearchMode, type SearchUnitType } from './search-params';

export type SearchView = 'list' | 'map';

export const SEARCH_PATH: Record<SearchMode, string> = { rent: '/louer', sale: '/acheter' };

const MAP_VIEW_VALUE = 'carte';

/** `vue=carte` is the only value that selects the map; anything else is the list. */
export function parseView(params: RawSearchParams): SearchView {
  const raw = params.vue;
  const first = Array.isArray(raw) ? raw[0] : raw;
  return first?.trim() === MAP_VIEW_VALUE ? 'map' : 'list';
}

/** Path of a search page, "?" added only when there is a query. */
export function searchHref(mode: SearchMode, filters: SearchFilters, view: SearchView = 'list'): string {
  const query = new URLSearchParams(toQueryString(filters));
  if (view === 'map') query.set('vue', MAP_VIEW_VALUE);
  const text = query.toString();
  return text ? `${SEARCH_PATH[mode]}?${text}` : SEARCH_PATH[mode];
}

export type ActiveFilter =
  | { id: string; kind: 'city'; value: string }
  | { id: string; kind: 'type'; value: SearchUnitType }
  | { id: string; kind: 'priceMin' | 'priceMax' | 'rooms' | 'surface'; value: number }
  | { id: string; kind: 'furnished' }
  | { id: string; kind: 'availableFrom'; value: string };

/** One removable chip per filter value (sort and page are not filters). */
export function activeFilters(filters: SearchFilters): ActiveFilter[] {
  const chips: ActiveFilter[] = [];
  for (const value of filters.cities) chips.push({ id: `city:${value}`, kind: 'city', value });
  for (const value of filters.types) chips.push({ id: `type:${value}`, kind: 'type', value });
  if (filters.priceMin !== undefined) chips.push({ id: 'priceMin', kind: 'priceMin', value: filters.priceMin });
  if (filters.priceMax !== undefined) chips.push({ id: 'priceMax', kind: 'priceMax', value: filters.priceMax });
  if (filters.roomsMin !== undefined) chips.push({ id: 'rooms', kind: 'rooms', value: filters.roomsMin });
  if (filters.surfaceMin !== undefined) chips.push({ id: 'surface', kind: 'surface', value: filters.surfaceMin });
  if (filters.furnished) chips.push({ id: 'furnished', kind: 'furnished' });
  if (filters.availableFrom !== undefined) chips.push({ id: 'availableFrom', kind: 'availableFrom', value: filters.availableFrom });
  return chips;
}

/** Copy of the filters without one chip, back on page 1 (the result set changed). */
export function removeFilter(filters: SearchFilters, chip: ActiveFilter): SearchFilters {
  const { priceMin, priceMax, roomsMin, surfaceMin, furnished, availableFrom, ...rest } = filters;
  const kept: SearchFilters = { ...rest, cities: [...filters.cities], types: [...filters.types], page: 1 };
  if (chip.kind === 'city') kept.cities = filters.cities.filter((city) => city !== chip.value);
  if (chip.kind === 'type') kept.types = filters.types.filter((type) => type !== chip.value);
  if (chip.kind !== 'priceMin' && priceMin !== undefined) kept.priceMin = priceMin;
  if (chip.kind !== 'priceMax' && priceMax !== undefined) kept.priceMax = priceMax;
  if (chip.kind !== 'rooms' && roomsMin !== undefined) kept.roomsMin = roomsMin;
  if (chip.kind !== 'surface' && surfaceMin !== undefined) kept.surfaceMin = surfaceMin;
  if (chip.kind !== 'furnished' && furnished) kept.furnished = furnished;
  if (chip.kind !== 'availableFrom' && availableFrom !== undefined) kept.availableFrom = availableFrom;
  return kept;
}

/**
 * Filters carried over when the visitor switches between « Louer » and « Acheter »: where (cities), what (types,
 * rooms, surface) and the sort stay. Prices never carry over (monthly rent and sale price are different scales), and
 * going to a sale also drops the rent-only filters (furnished, availability date). The page restarts at 1.
 */
export function switchMode(filters: SearchFilters, to: SearchMode): SearchFilters {
  const next: SearchFilters = { cities: [...filters.cities], types: [...filters.types], sort: filters.sort, page: 1 };
  if (filters.roomsMin !== undefined) next.roomsMin = filters.roomsMin;
  if (filters.surfaceMin !== undefined) next.surfaceMin = filters.surfaceMin;
  if (to === 'rent') {
    if (filters.furnished) next.furnished = true;
    if (filters.availableFrom !== undefined) next.availableFrom = filters.availableFrom;
  }
  return next;
}
