import { describe, expect, it } from 'vitest';
import { parseSearchParams, toQueryString, type SearchFilters } from './search-params';

const DEFAULTS: SearchFilters = { cities: [], types: [], sort: 'recent', page: 1 };

function fromQueryString(qs: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of new URLSearchParams(qs)) {
    const prev = out[key];
    out[key] = prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value];
  }
  return out;
}

describe('parseSearchParams', () => {
  it('reads every supported key', () => {
    expect(
      parseSearchParams({ ville: ['Carthage', 'La Marsa'], prix_max: '2000', pieces: '2', tri: 'price_asc', page: '2' }),
    ).toEqual({
      cities: ['Carthage', 'La Marsa'],
      types: [],
      priceMax: 2000,
      roomsMin: 2,
      sort: 'price_asc',
      page: 2,
    });
  });

  it('reads the remaining filters', () => {
    const filters = parseSearchParams({
      type: ['apartment', 'shop'],
      prix_min: '500.5',
      surface_min: '60',
      meuble: '1',
      dispo: '2026-12-31',
      ville: 'Tunis',
    });
    expect(filters).toEqual({
      cities: ['Tunis'],
      types: ['apartment', 'shop'],
      priceMin: 500.5,
      surfaceMin: 60,
      furnished: true,
      availableFrom: '2026-12-31',
      sort: 'recent',
      page: 1,
    });
  });

  it('ignores or clamps garbage', () => {
    const filters = parseSearchParams({
      prix_max: 'abc',
      page: '-3',
      pieces: '99',
      type: 'castle',
      dispo: '2026-13-40',
      tri: 'drop',
    });
    expect(filters.priceMax).toBeUndefined();
    expect(filters.page).toBe(1);
    expect(filters.roomsMin).toBe(10);
    expect(filters.types).toEqual([]);
    expect(filters.availableFrom).toBeUndefined();
    expect(filters.sort).toBe('recent');
  });

  it('rejects non-finite, negative and exponent numbers', () => {
    const filters = parseSearchParams({ prix_min: '-5', prix_max: 'Infinity', surface_min: '1e3', pieces: 'NaN' });
    expect(filters.priceMin).toBeUndefined();
    expect(filters.priceMax).toBeUndefined();
    expect(filters.surfaceMin).toBeUndefined();
    expect(filters.roomsMin).toBeUndefined();
  });

  it('clamps rooms to 1..10, page to 1..500 and amounts to a ceiling', () => {
    expect(parseSearchParams({ pieces: '0' }).roomsMin).toBe(1);
    expect(parseSearchParams({ pieces: '3.9' }).roomsMin).toBe(3);
    expect(parseSearchParams({ page: '9999' }).page).toBe(500);
    expect(parseSearchParams({ page: '2.5' }).page).toBe(1);
    expect(parseSearchParams({ prix_max: '99999999999999' }).priceMax).toBe(1_000_000_000);
  });

  it('keeps only real calendar dates for dispo', () => {
    expect(parseSearchParams({ dispo: '2026-02-30' }).availableFrom).toBeUndefined();
    expect(parseSearchParams({ dispo: '2026-2-3' }).availableFrom).toBeUndefined();
    expect(parseSearchParams({ dispo: '2028-02-29' }).availableFrom).toBe('2028-02-29');
  });

  it('only accepts meuble=1', () => {
    expect(parseSearchParams({ meuble: '0' }).furnished).toBeUndefined();
    expect(parseSearchParams({ meuble: 'true' }).furnished).toBeUndefined();
  });

  it('trims cities, cuts them to 60 characters, drops empty ones and keeps at most 10', () => {
    const long = 'x'.repeat(80);
    const filters = parseSearchParams({ ville: ['  Carthage  ', '', '   ', long] });
    expect(filters.cities).toEqual(['Carthage', 'x'.repeat(60)]);

    const many = Array.from({ length: 15 }, (_, i) => `Ville ${i}`);
    expect(parseSearchParams({ ville: many }).cities).toEqual(many.slice(0, 10));
  });

  it('keeps hostile city text as plain data and drops duplicates', () => {
    expect(parseSearchParams({ ville: ['<script>', '<script>'] }).cities).toEqual(['<script>']);
  });

  it('takes the first value of a repeated single-value key', () => {
    expect(parseSearchParams({ prix_max: ['100', '200'], tri: ['price_desc', 'recent'] })).toMatchObject({
      priceMax: 100,
      sort: 'price_desc',
    });
  });

  it('returns the defaults for nothing', () => {
    expect(parseSearchParams({})).toEqual(DEFAULTS);
  });

  it('keeps each allowed type once', () => {
    expect(parseSearchParams({ type: ['office', 'office', 'parking', 'house'] }).types).toEqual(['office', 'parking']);
  });
});

describe('toQueryString', () => {
  it('is empty for the defaults and has no leading question mark', () => {
    expect(toQueryString(DEFAULTS)).toBe('');
    expect(toQueryString({ ...DEFAULTS, cities: ['Tunis'] }).startsWith('?')).toBe(false);
  });

  it('leaves out page 1 and the recent sort, keeps the rest', () => {
    expect(toQueryString({ ...DEFAULTS, page: 2, sort: 'price_asc' })).toBe('tri=price_asc&page=2');
  });

  it('repeats array parameters and encodes spaces as +', () => {
    expect(toQueryString({ ...DEFAULTS, cities: ['La Marsa', 'Carthage'], types: ['apartment', 'office'] })).toBe(
      'ville=La+Marsa&ville=Carthage&type=apartment&type=office',
    );
  });

  it('round-trips through parseSearchParams', () => {
    const filters: SearchFilters = {
      cities: ['Carthage', 'La Marsa'],
      types: ['apartment', 'shop'],
      priceMin: 500,
      priceMax: 2000.5,
      roomsMin: 3,
      surfaceMin: 80,
      furnished: true,
      availableFrom: '2026-11-01',
      sort: 'price_desc',
      page: 4,
    };
    expect(parseSearchParams(fromQueryString(toQueryString(filters)))).toEqual(filters);
    expect(parseSearchParams(fromQueryString(toQueryString(DEFAULTS)))).toEqual(DEFAULTS);
  });
});
