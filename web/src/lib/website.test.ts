import { describe, expect, it } from 'vitest';
import { isOnWebsite, websiteBlockers, type WebsiteInput } from '@/lib/website';

const live: WebsiteInput = {
  show_on_website: true,
  archived_at: null,
  status: 'vacant',
  rent_amount: '900.000',
  sale_price: null,
  property: { archived_at: null },
  photoCount: 2,
};

describe('websiteBlockers', () => {
  it('is empty for a vacant, priced, photographed unit', () => {
    expect(websiteBlockers(live)).toEqual([]);
    expect(isOnWebsite(live)).toBe(true);
  });

  it('accepts a for-sale unit with a sale price, whatever its rent', () => {
    expect(websiteBlockers({ ...live, status: 'for_sale', rent_amount: null, sale_price: 350000 })).toEqual([]);
  });

  it('asks for a rent on a vacant unit, zero or empty', () => {
    expect(websiteBlockers({ ...live, rent_amount: 0 })).toEqual(['no_rent']);
    expect(websiteBlockers({ ...live, rent_amount: null })).toEqual(['no_rent']);
    expect(websiteBlockers({ ...live, rent_amount: '' })).toEqual(['no_rent']);
  });

  it('asks for a sale price on a for-sale unit, even when it has a rent', () => {
    expect(websiteBlockers({ ...live, status: 'for_sale', sale_price: null })).toEqual(['no_sale_price']);
  });

  it('refuses the statuses that are not on offer', () => {
    for (const status of ['rented', 'sold', 'under_maintenance']) {
      expect(websiteBlockers({ ...live, status })).toEqual(['status']);
    }
  });

  it('asks for a photo of the unit', () => {
    expect(websiteBlockers({ ...live, photoCount: 0 })).toEqual(['no_photo']);
  });

  it('reports the archived unit, the archived bien and the hidden toggle', () => {
    expect(websiteBlockers({ ...live, archived_at: '2026-10-01T00:00:00Z' })).toEqual(['unit_archived']);
    expect(websiteBlockers({ ...live, property: { archived_at: '2026-10-01T00:00:00Z' } })).toEqual(['property_archived']);
    expect(websiteBlockers({ ...live, show_on_website: false })).toEqual(['hidden']);
  });

  it('lists every blocker at once, in order', () => {
    expect(websiteBlockers({ ...live, show_on_website: false, rent_amount: null, photoCount: 0 })).toEqual(['hidden', 'no_rent', 'no_photo']);
  });
});
