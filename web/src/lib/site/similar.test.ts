import { describe, expect, it } from 'vitest';
import type { PublicListing } from './listings-queries';
import { pickSimilar } from './similar';

function listing(id: string, price: number, overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id,
    organizationId: 'org',
    unitId: `unit-${id}`,
    kind: 'rent',
    title: id,
    description: null,
    price,
    charges: null,
    depositMonths: 2,
    reservationDeposit: 10000,
    reservationDays: 15,
    availableFrom: null,
    furnished: false,
    amenities: [],
    virtualTourUrl: null,
    publishedAt: null,
    unitType: 'apartment',
    rooms: 2,
    surfaceM2: 80,
    floor: null,
    unitStatus: 'vacant',
    city: 'Carthage',
    governorate: 'Tunis',
    latitude: null,
    longitude: null,
    coverFileId: null,
    photoCount: 0,
    ...overrides,
  };
}

describe('pickSimilar', () => {
  const base = listing('base', 1450);

  it('keeps same kind and city within +-25 %, closest price first, never the base', () => {
    const candidates = [
      base,
      listing('same', 1450),
      listing('low', 1100),
      listing('high', 1800),
      listing('too-high', 1900),
      listing('other-city', 1450, { city: 'La Marsa' }),
      listing('sale', 1450, { kind: 'sale' }),
    ];
    expect(pickSimilar(base, candidates).map((l) => l.id)).toEqual(['same', 'low', 'high']);
  });

  it('includes both ends of the 1 087.5 to 1 812.5 range and nothing beyond', () => {
    const edges = [listing('lo', 1087.5), listing('hi', 1812.5), listing('under', 1087.4), listing('over', 1812.6)];
    expect(pickSimilar(base, edges).map((l) => l.id).sort()).toEqual(['hi', 'lo']);
  });

  it('orders by distance from the base price', () => {
    const candidates = [listing('far', 1700), listing('near', 1500), listing('mid', 1250)];
    expect(pickSimilar(base, candidates).map((l) => l.id)).toEqual(['near', 'mid', 'far']);
  });

  it('honours the limit (default 3)', () => {
    const candidates = Array.from({ length: 6 }, (_, i) => listing(`c${i}`, 1450 + i * 10));
    expect(pickSimilar(base, candidates)).toHaveLength(3);
    expect(pickSimilar(base, candidates, 2).map((l) => l.id)).toEqual(['c0', 'c1']);
    expect(pickSimilar(base, candidates, 0)).toEqual([]);
  });

  it('matches cities regardless of case and spacing', () => {
    expect(pickSimilar(base, [listing('x', 1450, { city: ' carthage ' })]).map((l) => l.id)).toEqual(['x']);
  });

  it('returns nothing when the base has no usable price', () => {
    expect(pickSimilar(listing('free', 0), [listing('a', 0)])).toEqual([]);
  });
});
