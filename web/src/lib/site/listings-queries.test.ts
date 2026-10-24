import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NO_DETAILS_ROW } from './listing-details';
import type { ListingRow } from './listings-queries';
import type { SearchFilters } from './search-params';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ cacheLife: vi.fn() }));

const publicQuery = vi.fn();
vi.mock('./public-api', () => ({ publicQuery: (...args: unknown[]) => publicQuery(...args) }));

const ORG = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const DEFAULT_FILTERS: SearchFilters = { cities: [], types: [], sort: 'recent', page: 1 };

async function load(orgId = ORG) {
  vi.stubEnv('NEXT_PUBLIC_AGENCY_ORG_ID', orgId);
  vi.resetModules();
  return import('./listings-queries');
}

function row(overrides: Partial<ListingRow> = {}): ListingRow {
  return {
    id: LISTING_ID,
    organization_id: ORG,
    unit_id: '33333333-3333-4333-8333-333333333333',
    kind: 'rent',
    title: 'Appartement S+2 a Carthage',
    description: null,
    price: '1450.000',
    charges: 50,
    deposit_months: 2,
    reservation_deposit: '10000.000',
    reservation_days: 15,
    available_from: '2026-11-01',
    furnished: true,
    amenities: ['lift'],
    virtual_tour_url: null,
    published_at: '2026-10-01T10:00:00+00:00',
    unit_type: 'apartment',
    rooms: 3,
    surface_m2: '82.5',
    floor: 2,
    unit_status: 'vacant',
    city: 'Carthage',
    governorate: 'Tunis',
    latitude: 36.853,
    longitude: 10.323,
    cover_file_id: 'file-1',
    photo_count: 2,
    ...NO_DETAILS_ROW,
    ...overrides,
  };
}

/** The `where` variable the last call sent, flattened to its list of conditions. */
function conditions(call = publicQuery.mock.calls.at(-1), key = 'where'): unknown[] {
  const variables = call?.[1] as Record<string, { _and: unknown[] }>;
  return variables[key]._and;
}

beforeEach(() => {
  publicQuery.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('toPublicListing', () => {
  it('maps snake_case rows to camelCase and numbers sent as strings', async () => {
    const { toPublicListing } = await load();
    const listing = toPublicListing(row({ photos: [{ storage_file_id: 'f2', position: 2 }, { storage_file_id: 'f1', position: 1 }] }));
    expect(listing).toMatchObject({
      id: LISTING_ID,
      organizationId: ORG,
      unitId: '33333333-3333-4333-8333-333333333333',
      kind: 'rent',
      price: 1450,
      charges: 50,
      depositMonths: 2,
      reservationDeposit: 10000,
      reservationDays: 15,
      availableFrom: '2026-11-01',
      furnished: true,
      amenities: ['lift'],
      unitType: 'apartment',
      rooms: 3,
      surfaceM2: 82.5,
      unitStatus: 'vacant',
      city: 'Carthage',
      latitude: 36.853,
      coverFileId: 'file-1',
      photoCount: 2,
    });
    expect(listing.photos).toEqual([
      { storageFileId: 'f2', position: 2 },
      { storageFileId: 'f1', position: 1 },
    ]);
  });

  it('keeps a null city as null', async () => {
    const { toPublicListing } = await load();
    expect(toPublicListing(row({ city: null })).city).toBeNull();
  });

  it('keeps nulls and leaves photos out when the row has none', async () => {
    const { toPublicListing } = await load();
    const listing = toPublicListing(row({ charges: null, rooms: null, surface_m2: null, cover_file_id: null, photo_count: 0 }));
    expect(listing).toMatchObject({ charges: null, rooms: null, surfaceM2: null, coverFileId: null, photoCount: 0 });
    expect('photos' in listing).toBe(false);
  });
});

describe('listingsWhere (R6: one shared where helper)', () => {
  it('always filters organization, kind and offerable unit statuses', async () => {
    const { listingsWhere, EXCLUDED_UNIT_STATUSES } = await load();
    expect(EXCLUDED_UNIT_STATUSES).toEqual(['sold', 'under_maintenance']);
    const where = listingsWhere('rent', DEFAULT_FILTERS) as { _and: unknown[] };
    expect(where._and).toEqual(
      expect.arrayContaining([
        { organization_id: { _eq: ORG } },
        { kind: { _eq: 'rent' } },
        { unit_status: { _nin: ['sold', 'under_maintenance'] } },
      ]),
    );
  });

  it('adds one condition per active filter', async () => {
    const { listingsWhere } = await load();
    const where = listingsWhere('sale', {
      cities: ['Carthage', 'La Marsa'],
      types: ['apartment', 'shop'],
      priceMin: 100,
      priceMax: 900,
      roomsMin: 2,
      surfaceMin: 50,
      furnished: true,
      availableFrom: '2026-12-01',
      sort: 'recent',
      page: 1,
    }) as { _and: unknown[] };
    expect(where._and).toEqual(
      expect.arrayContaining([
        { city: { _in: ['Carthage', 'La Marsa'] } },
        { unit_type: { _in: ['apartment', 'shop'] } },
        { price: { _gte: 100, _lte: 900 } },
        { rooms: { _gte: 2 } },
        { surface_m2: { _gte: 50 } },
        { furnished: { _eq: true } },
        { _or: [{ available_from: { _is_null: true } }, { available_from: { _lte: '2026-12-01' } }] },
      ]),
    );
  });
});

describe('getLatestListings', () => {
  it('queries the latest listings of a mode and maps them', async () => {
    publicQuery.mockResolvedValue({ listings: [row()] });
    const { getLatestListings } = await load();
    const result = await getLatestListings('rent', 6);

    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(1450);
    const [query, variables] = publicQuery.mock.calls[0];
    expect(query).toContain('public_listings');
    expect(variables).toMatchObject({ limit: 6, orderBy: [{ published_at: 'desc_nulls_last' }, { id: 'asc' }] });
    expect(conditions()).toEqual(expect.arrayContaining([{ kind: { _eq: 'rent' } }, { organization_id: { _eq: ORG } }]));
  });

  it('is resilient: logs and returns [] when the query fails', async () => {
    publicQuery.mockRejectedValue(new Error('role public not found'));
    const { getLatestListings } = await load();
    await expect(getLatestListings('rent', 3)).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[public-listings] getLatestListings failed'), expect.any(Error));
  });

  it('makes no network call without an organization id', async () => {
    const { getLatestListings } = await load('');
    await expect(getLatestListings('rent', 3)).resolves.toEqual([]);
    expect(publicQuery).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('NEXT_PUBLIC_AGENCY_ORG_ID is not set'));
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('searchListings', () => {
  const reply = {
    items: [row()],
    total: { aggregate: { count: 25 } },
    cities: [{ city: 'Carthage' }, { city: 'La Marsa' }],
  };

  it('returns items, total and the cities of the mode, with page offset and price sort', async () => {
    publicQuery.mockResolvedValue(reply);
    const { searchListings, PAGE_SIZE } = await load();
    const result = await searchListings('rent', { ...DEFAULT_FILTERS, sort: 'price_asc', page: 3 });

    expect(result.total).toBe(25);
    expect(result.cities).toEqual(['Carthage', 'La Marsa']);
    expect(result.items).toHaveLength(1);
    const variables = publicQuery.mock.calls[0][1];
    expect(variables).toMatchObject({
      limit: PAGE_SIZE,
      offset: 2 * PAGE_SIZE,
      orderBy: [{ price: 'asc' }, { published_at: 'desc_nulls_last' }, { id: 'asc' }],
    });
    expect(PAGE_SIZE).toBe(12);
  });

  it('sorts by descending price', async () => {
    publicQuery.mockResolvedValue(reply);
    const { searchListings } = await load();
    await searchListings('sale', { ...DEFAULT_FILTERS, sort: 'price_desc' });
    expect(publicQuery.mock.calls[0][1]).toMatchObject({
      orderBy: [{ price: 'desc' }, { published_at: 'desc_nulls_last' }, { id: 'asc' }],
    });
  });

  it('lists cities of the mode without the user filters', async () => {
    publicQuery.mockResolvedValue(reply);
    const { searchListings } = await load();
    await searchListings('rent', { ...DEFAULT_FILTERS, cities: ['Carthage'], priceMax: 500 });
    const citiesWhere = conditions(publicQuery.mock.calls[0], 'citiesWhere');
    expect(citiesWhere).toEqual(expect.arrayContaining([{ kind: { _eq: 'rent' } }, { unit_status: { _nin: ['sold', 'under_maintenance'] } }]));
    expect(JSON.stringify(citiesWhere)).not.toContain('Carthage');
    expect(citiesWhere).toContainEqual({ city: { _is_null: false } });
  });

  it('passes hostile input as variables, never inside the query text', async () => {
    publicQuery.mockResolvedValue(reply);
    const { searchListings } = await load();
    const evil = '<script>"} ) { x } #';
    await searchListings('rent', { ...DEFAULT_FILTERS, cities: [evil], availableFrom: '2026-01-01' });

    const [query, variables] = publicQuery.mock.calls[0];
    expect(query).not.toContain('<script>');
    expect(query).not.toContain('Carthage');
    expect(query).not.toContain(ORG);
    expect(JSON.stringify(variables)).toContain('<script>');
  });

  it('is resilient: empty result on failure', async () => {
    publicQuery.mockRejectedValue(new Error('boom'));
    const { searchListings } = await load();
    await expect(searchListings('rent', DEFAULT_FILTERS)).resolves.toEqual({ items: [], total: 0, cities: [] });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[public-listings] searchListings failed'), expect.any(Error));
  });

  it('is resilient without an organization id', async () => {
    const { searchListings } = await load('');
    await expect(searchListings('rent', DEFAULT_FILTERS)).resolves.toEqual({ items: [], total: 0, cities: [] });
    expect(publicQuery).not.toHaveBeenCalled();
  });
});

describe('getListing', () => {
  it('returns the listing with its photos', async () => {
    publicQuery.mockResolvedValue({
      listings: [row({ photos: [{ storage_file_id: 'f1', position: 1 }] })],
    });
    const { getListing } = await load();
    const listing = await getListing(LISTING_ID);

    expect(listing?.id).toBe(LISTING_ID);
    expect(listing?.photos).toEqual([{ storageFileId: 'f1', position: 1 }]);
    const [query, variables] = publicQuery.mock.calls[0];
    expect(query).toContain('photos');
    expect(variables).toMatchObject({ limit: 1 });
    expect(conditions()).toEqual(
      expect.arrayContaining([
        { id: { _eq: LISTING_ID } },
        { organization_id: { _eq: ORG } },
        { unit_status: { _nin: ['sold', 'under_maintenance'] } },
      ]),
    );
  });

  it('returns null when absent, for another organization or unpublished (no row)', async () => {
    publicQuery.mockResolvedValue({ listings: [] });
    const { getListing } = await load();
    await expect(getListing(LISTING_ID)).resolves.toBeNull();
  });

  it('returns null without a call for something that is not a uuid', async () => {
    const { getListing } = await load();
    await expect(getListing('not-a-uuid')).resolves.toBeNull();
    await expect(getListing("1' or '1'='1")).resolves.toBeNull();
    expect(publicQuery).not.toHaveBeenCalled();
  });

  it('returns null and logs when the query fails', async () => {
    publicQuery.mockRejectedValue(new Error('boom'));
    const { getListing } = await load();
    await expect(getListing(LISTING_ID)).resolves.toBeNull();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[public-listings] getListing failed'), expect.any(Error));
  });

  it('returns null without an organization id', async () => {
    const { getListing } = await load('');
    await expect(getListing(LISTING_ID)).resolves.toBeNull();
    expect(publicQuery).not.toHaveBeenCalled();
  });
});

describe('countPublished', () => {
  it('counts listings of both modes and distinct cities', async () => {
    publicQuery.mockResolvedValue({
      total: { aggregate: { count: 17 } },
      cities: [{ city: 'Carthage' }, { city: 'La Marsa' }, { city: 'Tunis' }],
    });
    const { countPublished } = await load();
    await expect(countPublished()).resolves.toEqual({ total: 17, cities: 3 });
    const variables = publicQuery.mock.calls[0][1] as { where: { _and: unknown[] }; citiesWhere: { _and: unknown[] } };
    // the cities count leaves out listings without a city; the total keeps them
    expect(variables.citiesWhere._and).toContainEqual({ city: { _is_null: false } });
    expect(JSON.stringify(variables.where)).not.toContain('city');
    expect(variables.where._and).toEqual(
      expect.arrayContaining([{ organization_id: { _eq: ORG } }, { unit_status: { _nin: ['sold', 'under_maintenance'] } }]),
    );
    expect(JSON.stringify(variables.where)).not.toContain('"kind"');
  });

  it('is resilient: zeros on failure and without an organization id', async () => {
    publicQuery.mockRejectedValue(new Error('boom'));
    const first = await load();
    await expect(first.countPublished()).resolves.toEqual({ total: 0, cities: 0 });
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[public-listings] countPublished failed'), expect.any(Error));

    publicQuery.mockClear();
    const second = await load('');
    await expect(second.countPublished()).resolves.toEqual({ total: 0, cities: 0 });
    expect(publicQuery).not.toHaveBeenCalled();
  });
});

describe('getPublishedCities', () => {
  it('lists the distinct cities of published listings, with the shared where and without listings lacking a city', async () => {
    publicQuery.mockResolvedValue({ cities: [{ city: 'Carthage' }, { city: 'La Marsa' }] });
    const { getPublishedCities } = await load();
    await expect(getPublishedCities()).resolves.toEqual(['Carthage', 'La Marsa']);
    const where = conditions();
    expect(where).toContainEqual({ city: { _is_null: false } });
    expect(where).toEqual(
      expect.arrayContaining([{ organization_id: { _eq: ORG } }, { unit_status: { _nin: ['sold', 'under_maintenance'] } }]),
    );
    expect(JSON.stringify(where)).not.toContain('"kind"');
  });

  it('is resilient: [] on failure and without an organization id', async () => {
    publicQuery.mockRejectedValue(new Error('boom'));
    const first = await load();
    await expect(first.getPublishedCities()).resolves.toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[public-listings] getPublishedCities failed'), expect.any(Error));

    publicQuery.mockClear();
    const second = await load('');
    await expect(second.getPublishedCities()).resolves.toEqual([]);
    expect(publicQuery).not.toHaveBeenCalled();
  });
});
