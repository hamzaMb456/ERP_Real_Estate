import { describe, expect, it } from 'vitest';
import { parseSearchParams } from './search-params';
import { activeFilters, parseView, removeFilter, searchHref, switchMode } from './search-links';

describe('searchHref', () => {
  it('is the bare path without a "?" when nothing is filtered', () => {
    expect(searchHref('rent', parseSearchParams({}))).toBe('/louer');
    expect(searchHref('sale', parseSearchParams({}))).toBe('/acheter');
  });

  it('keeps the filters and adds the map view', () => {
    const filters = parseSearchParams({ ville: 'Carthage', prix_max: '2000' });
    expect(searchHref('rent', filters)).toBe('/louer?ville=Carthage&prix_max=2000');
    expect(searchHref('rent', filters, 'map')).toBe('/louer?ville=Carthage&prix_max=2000&vue=carte');
    expect(searchHref('rent', parseSearchParams({}), 'map')).toBe('/louer?vue=carte');
  });
});

describe('parseView', () => {
  it('reads vue=carte and nothing else', () => {
    expect(parseView({ vue: 'carte' })).toBe('map');
    expect(parseView({ vue: ['carte', 'x'] })).toBe('map');
    expect(parseView({ vue: 'liste' })).toBe('list');
    expect(parseView({ vue: '<script>' })).toBe('list');
    expect(parseView({})).toBe('list');
  });
});

describe('activeFilters / removeFilter', () => {
  const filters = parseSearchParams({
    ville: ['Carthage', 'Tunis'],
    type: 'office',
    prix_min: '500',
    prix_max: '2000',
    pieces: '3',
    surface_min: '40',
    meuble: '1',
    dispo: '2026-12-01',
    tri: 'price_asc',
    page: '4',
  });

  it('lists one chip per value, sort and page excluded', () => {
    expect(activeFilters(filters).map((filter) => filter.kind)).toEqual([
      'city',
      'city',
      'type',
      'priceMin',
      'priceMax',
      'rooms',
      'surface',
      'furnished',
      'availableFrom',
    ]);
  });

  it('removes exactly one value and goes back to page 1', () => {
    const [carthage] = activeFilters(filters);
    const next = removeFilter(filters, carthage);
    expect(next.cities).toEqual(['Tunis']);
    expect(next.page).toBe(1);
    expect(next.sort).toBe('price_asc');
    expect(next.priceMax).toBe(2000);
  });

  it('does not mutate the filters it was given', () => {
    const before = JSON.stringify(filters);
    for (const filter of activeFilters(filters)) removeFilter(filters, filter);
    expect(JSON.stringify(filters)).toBe(before);
  });

  it('clears every kind of chip', () => {
    let current = filters;
    for (const filter of activeFilters(filters)) current = removeFilter(current, filter);
    expect(activeFilters(current)).toEqual([]);
  });
});

describe('switchMode', () => {
  const filters = parseSearchParams({
    ville: 'Carthage',
    type: 'apartment',
    prix_min: '500',
    prix_max: '2000',
    pieces: '3',
    surface_min: '40',
    meuble: '1',
    dispo: '2026-12-01',
    tri: 'price_desc',
    page: '3',
  });

  it('drops the price filters, the rent-only filters and the page, keeps the rest', () => {
    const sale = switchMode(filters, 'sale');
    expect(sale).toEqual(parseSearchParams({ ville: 'Carthage', type: 'apartment', pieces: '3', surface_min: '40', tri: 'price_desc' }));
  });

  it('drops the price filters going back to rent too, but keeps the rent-only ones', () => {
    const rent = switchMode(filters, 'rent');
    expect(rent.priceMin).toBeUndefined();
    expect(rent.priceMax).toBeUndefined();
    expect(rent.furnished).toBe(true);
    expect(rent.cities).toEqual(['Carthage']);
  });
});
