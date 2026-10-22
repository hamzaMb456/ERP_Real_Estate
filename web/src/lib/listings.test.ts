import { describe, expect, it } from 'vitest';
import {
  AMENITIES,
  buildListingFields,
  defaultKindFor,
  kindsFor,
  listingErrorKey,
  toFormState,
  validateListing,
  type ListingFormState,
} from './listings';

const state = (patch: Partial<ListingFormState> = {}): ListingFormState => ({
  ...toFormState(undefined),
  title: 'Appartement S+2',
  price: '1 250,500',
  ...patch,
});

describe('defaultKindFor', () => {
  it('lists for sale a unit for sale, for rent a vacant or rented one, and nothing otherwise', () => {
    expect(defaultKindFor('for_sale')).toBe('sale');
    expect(defaultKindFor('vacant')).toBe('rent');
    expect(defaultKindFor('rented')).toBe('rent');
    expect(defaultKindFor('sold')).toBeNull();
    expect(defaultKindFor('under_maintenance')).toBeNull();
  });
});

describe('kindsFor', () => {
  it('offers the kinds the publishing rules can accept for the unit status', () => {
    expect(kindsFor('vacant')).toEqual(['rent']);
    expect(kindsFor('for_sale')).toEqual(['sale']);
    expect(kindsFor('rented')).toEqual(['rent', 'sale']);
    expect(kindsFor('sold')).toEqual([]);
  });
});

describe('AMENITIES', () => {
  it('has the nine values of the database check, in order', () => {
    expect([...AMENITIES]).toEqual(['parking', 'lift', 'air_conditioning', 'heating', 'sea_view', 'balcony', 'garden', 'security', 'equipped_kitchen']);
  });
});

describe('listingErrorKey', () => {
  it('finds a LISTING_* code inside a GraphQL error message', () => {
    expect(listingErrorKey('database query error: LISTING_NEEDS_PHOTO')).toBe('needsPhoto');
    expect(listingErrorKey('LISTING_NEEDS_PRICE')).toBe('needsPrice');
    expect(listingErrorKey('x LISTING_UNIT_ARCHIVED y')).toBe('unitArchived');
    expect(listingErrorKey('LISTING_UNIT_NOT_RENTABLE')).toBe('notRentable');
    expect(listingErrorKey('LISTING_UNIT_NOT_SELLABLE')).toBe('notSellable');
  });

  it('answers null for anything else', () => {
    expect(listingErrorKey('lease_not_draft')).toBeNull();
    expect(listingErrorKey('')).toBeNull();
  });
});

describe('validateListing', () => {
  it('accepts a complete rent listing', () => {
    expect(validateListing(state(), 'rent')).toEqual({});
  });

  it('asks for a title', () => {
    expect(validateListing(state({ title: '   ' }), 'rent').title).toBe('Champ obligatoire.');
  });

  it('lets the price stay empty (a draft has none yet) but refuses a bad or null price', () => {
    expect(validateListing(state({ price: '' }), 'rent').price).toBeUndefined();
    expect(validateListing(state({ price: 'abc' }), 'rent').price).toBeDefined();
    expect(validateListing(state({ price: '0' }), 'rent').price).toBeDefined();
  });

  it('checks the rent-only fields on a rent listing only', () => {
    expect(validateListing(state({ depositMonths: '13' }), 'rent').depositMonths).toBeDefined();
    expect(validateListing(state({ charges: 'x' }), 'rent').charges).toBeDefined();
    expect(validateListing(state({ depositMonths: '13', charges: 'x' }), 'sale')).toEqual({});
  });

  it('checks the sale-only fields on a sale listing only', () => {
    expect(validateListing(state({ reservationDays: '0' }), 'sale').reservationDays).toBeDefined();
    expect(validateListing(state({ reservationDays: '91' }), 'sale').reservationDays).toBeDefined();
    expect(validateListing(state({ reservationDeposit: '-5' }), 'sale').reservationDeposit).toBeDefined();
    expect(validateListing(state({ reservationDays: '0' }), 'rent')).toEqual({});
  });

  it('accepts only web addresses for the virtual tour', () => {
    expect(validateListing(state({ virtualTourUrl: 'javascript:alert(1)' }), 'rent').virtualTourUrl).toBeDefined();
    expect(validateListing(state({ virtualTourUrl: 'https://tour.example/1' }), 'rent')).toEqual({});
  });
});

describe('buildListingFields', () => {
  it('builds the rent columns with numbers and nulls for empty text', () => {
    expect(buildListingFields(state({ charges: '45', amenities: ['lift', 'parking'], furnished: true }), 'rent')).toEqual({
      title: 'Appartement S+2',
      description: null,
      price: 1250.5,
      available_from: null,
      furnished: true,
      amenities: ['parking', 'lift'],
      virtual_tour_url: null,
      charges: 45,
      deposit_months: 2,
    });
  });

  it('builds the sale columns without the rent-only ones', () => {
    const fields = buildListingFields(state({ price: '350000' }), 'sale');
    expect(fields).toMatchObject({ price: 350000, reservation_deposit: 10000, reservation_days: 15 });
    expect(fields).not.toHaveProperty('charges');
    expect(fields).not.toHaveProperty('deposit_months');
  });

  it('sends a null price when the field is empty', () => {
    expect(buildListingFields(state({ price: '' }), 'rent').price).toBeNull();
  });
});
