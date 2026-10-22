// Listings (annonces): kinds, statuses, the form state and the columns it writes. The publishing rules themselves
// live in the database (trigger check_listing_publishable); this file only maps their error codes to sentences.

import type { Messages } from '@/i18n/messages';
import { getMessages } from '@/i18n/store';
import { parseMoney } from '@/lib/leases';

export type ListingKind = 'rent' | 'sale';
export type ListingStatus = 'draft' | 'published' | 'paused' | 'closed';

/** The values of the database check on listings.amenities; labels live in the dictionary (listings.amenities). */
export const AMENITIES = ['parking', 'lift', 'air_conditioning', 'heating', 'sea_view', 'balcony', 'garden', 'security', 'equipped_kitchen'] as const;
export type Amenity = (typeof AMENITIES)[number];

export type ListingRecord = {
  id: string;
  kind: ListingKind;
  status: ListingStatus;
  title: string;
  description: string | null;
  price: number | string | null;
  charges: number | string | null;
  deposit_months: number;
  reservation_deposit: number | string;
  reservation_days: number;
  available_from: string | null;
  furnished: boolean;
  amenities: string[];
  virtual_tour_url: string | null;
};

/** The kind a new listing starts with: a unit for sale is sold, a vacant or rented one is let. */
export function defaultKindFor(unitStatus: string): ListingKind | null {
  if (unitStatus === 'for_sale') return 'sale';
  if (unitStatus === 'vacant' || unitStatus === 'rented') return 'rent';
  return null;
}

/** The kinds the publishing rules can accept for a unit status (a rented unit can be re-let soon, or sold). */
export function kindsFor(unitStatus: string): ListingKind[] {
  if (unitStatus === 'vacant') return ['rent'];
  if (unitStatus === 'for_sale') return ['sale'];
  if (unitStatus === 'rented') return ['rent', 'sale'];
  return [];
}

const ERROR_KEYS: Record<string, keyof Messages['listings']['errors']> = {
  LISTING_NEEDS_PRICE: 'needsPrice',
  LISTING_NEEDS_PHOTO: 'needsPhoto',
  LISTING_UNIT_ARCHIVED: 'unitArchived',
  LISTING_UNIT_NOT_RENTABLE: 'notRentable',
  LISTING_UNIT_NOT_SELLABLE: 'notSellable',
};

/** Finds a LISTING_* code inside a GraphQL error message. */
export function listingErrorKey(message: string): keyof Messages['listings']['errors'] | null {
  const code = Object.keys(ERROR_KEYS).find((needle) => message.includes(needle));
  return code ? ERROR_KEYS[code] : null;
}

/** What the form holds: text as typed, numbers parsed only when saving. */
export type ListingFormState = {
  title: string;
  description: string;
  price: string;
  charges: string;
  depositMonths: string;
  reservationDeposit: string;
  reservationDays: string;
  availableFrom: string;
  furnished: boolean;
  amenities: string[];
  virtualTourUrl: string;
};

export type ListingFormErrors = Partial<Record<'title' | 'price' | 'charges' | 'depositMonths' | 'reservationDeposit' | 'reservationDays' | 'virtualTourUrl', string>>;

const text = (value: number | string | null | undefined): string => (value === null || value === undefined ? '' : String(Number(value)));

export function toFormState(listing: ListingRecord | undefined): ListingFormState {
  return {
    title: listing?.title ?? '',
    description: listing?.description ?? '',
    price: text(listing?.price),
    charges: text(listing?.charges),
    depositMonths: String(listing?.deposit_months ?? 2),
    reservationDeposit: text(listing?.reservation_deposit ?? 10000),
    reservationDays: String(listing?.reservation_days ?? 15),
    availableFrom: listing?.available_from ?? '',
    furnished: listing?.furnished ?? false,
    amenities: listing?.amenities ?? [],
    virtualTourUrl: listing?.virtual_tour_url ?? '',
  };
}

const isWholeNumberBetween = (value: string, min: number, max: number): boolean => /^\d+$/.test(value.trim()) && Number(value) >= min && Number(value) <= max;

/** A price may stay empty on a draft (the database refuses to publish without one); when typed it must be positive. */
export function validateListing(state: ListingFormState, kind: ListingKind): ListingFormErrors {
  const t = getMessages();
  const errors: ListingFormErrors = {};
  if (state.title.trim() === '') errors.title = t.common.required;
  if (state.price.trim() !== '') {
    const price = parseMoney(state.price);
    if (price === null || price <= 0) errors.price = t.listings.validation.priceInvalid;
  }
  if (kind === 'rent') {
    if (state.charges.trim() !== '' && parseMoney(state.charges) === null) errors.charges = t.listings.validation.chargesInvalid;
    if (!isWholeNumberBetween(state.depositMonths, 0, 12)) errors.depositMonths = t.listings.validation.depositMonthsInvalid;
  } else {
    if (parseMoney(state.reservationDeposit) === null) errors.reservationDeposit = t.listings.validation.reservationDepositInvalid;
    if (!isWholeNumberBetween(state.reservationDays, 1, 90)) errors.reservationDays = t.listings.validation.reservationDaysInvalid;
  }
  const tour = state.virtualTourUrl.trim();
  if (tour !== '' && !/^https?:\/\//i.test(tour)) errors.virtualTourUrl = t.listings.validation.virtualTourInvalid;
  return errors;
}

/** The writable columns for a validated form. Rent-only and sale-only columns are sent for their own kind only. */
export function buildListingFields(state: ListingFormState, kind: ListingKind): Record<string, unknown> {
  const common = {
    title: state.title.trim(),
    description: state.description.trim() || null,
    price: state.price.trim() === '' ? null : parseMoney(state.price),
    available_from: state.availableFrom || null,
    furnished: state.furnished,
    amenities: AMENITIES.filter((amenity) => state.amenities.includes(amenity)),
    virtual_tour_url: state.virtualTourUrl.trim() || null,
  };
  if (kind === 'rent') {
    return { ...common, charges: state.charges.trim() === '' ? null : parseMoney(state.charges), deposit_months: Number(state.depositMonths) };
  }
  return { ...common, reservation_deposit: parseMoney(state.reservationDeposit), reservation_days: Number(state.reservationDays) };
}
