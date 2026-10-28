// The details of a public listing added by migration 0007 (bedrooms, condition, orientation, legal status, lease terms, the
// bien's year built and neighbourhood…). Kept apart from the query module so components and tests can use the types and
// the empty value without importing server-only code.

export type NumberLike = number | string | null | undefined;

export type ListingDetails = {
  bedrooms: number | null;
  bathrooms: number | null;
  parkingSpaces: number | null;
  /** One of the CONDITIONS of lib/website.ts; anything else is not displayed. */
  propertyCondition: string | null;
  /** null = not specified: nothing is shown. */
  petsAllowed: boolean | null;
  legalStatus: string | null;
  orientation: string[];
  outdoorAreaM2: number | null;
  energyClass: string | null;
  minLeaseMonths: number | null;
  chargesIncluded: string[];
  yearBuilt: number | null;
  floorsCount: number | null;
  neighbourhoodDescription: string | null;
  visitFee: number | null;
};

/** A listing row of public_listings as the data layer returns it, details part. */
export type ListingDetailsRow = {
  bedrooms: NumberLike;
  bathrooms: NumberLike;
  parking_spaces: NumberLike;
  property_condition: string | null;
  pets_allowed: boolean | null;
  legal_status: string | null;
  orientation: string[] | null;
  outdoor_area_m2: NumberLike;
  energy_class: string | null;
  min_lease_months: NumberLike;
  charges_included: string[] | null;
  year_built: NumberLike;
  floors_count: NumberLike;
  neighbourhood_description: string | null;
  visit_fee: NumberLike;
};

export const NO_DETAILS: ListingDetails = {
  bedrooms: null,
  bathrooms: null,
  parkingSpaces: null,
  propertyCondition: null,
  petsAllowed: null,
  legalStatus: null,
  orientation: [],
  outdoorAreaM2: null,
  energyClass: null,
  minLeaseMonths: null,
  chargesIncluded: [],
  yearBuilt: null,
  floorsCount: null,
  neighbourhoodDescription: null,
  visitFee: null,
};

export const NO_DETAILS_ROW: ListingDetailsRow = {
  bedrooms: null,
  bathrooms: null,
  parking_spaces: null,
  property_condition: null,
  pets_allowed: null,
  legal_status: null,
  orientation: [],
  outdoor_area_m2: null,
  energy_class: null,
  min_lease_months: null,
  charges_included: [],
  year_built: null,
  floors_count: null,
  neighbourhood_description: null,
  visit_fee: null,
};

/** The columns the public queries select for the details. */
export const DETAIL_FIELDS = `
  bedrooms bathrooms parking_spaces property_condition pets_allowed legal_status orientation outdoor_area_m2
  energy_class min_lease_months charges_included year_built floors_count neighbourhood_description visit_fee
`;

/** The data layer sends numeric columns as numbers or as strings depending on its serde settings. */
export function toNumber(value: NumberLike): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toListingDetails(row: ListingDetailsRow): ListingDetails {
  return {
    bedrooms: toNumber(row.bedrooms),
    bathrooms: toNumber(row.bathrooms),
    parkingSpaces: toNumber(row.parking_spaces),
    propertyCondition: row.property_condition,
    petsAllowed: row.pets_allowed,
    legalStatus: row.legal_status,
    orientation: row.orientation ?? [],
    outdoorAreaM2: toNumber(row.outdoor_area_m2),
    energyClass: row.energy_class,
    minLeaseMonths: toNumber(row.min_lease_months),
    chargesIncluded: row.charges_included ?? [],
    yearBuilt: toNumber(row.year_built),
    floorsCount: toNumber(row.floors_count),
    neighbourhoodDescription: row.neighbourhood_description?.trim() || null,
    visitFee: toNumber(row.visit_fee),
  };
}
