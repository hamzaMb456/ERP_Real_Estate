// Website visibility of a unit. There is no listing step: a unit is on the public site by itself when the database view
// public_listings (migration 0006) includes it. This file repeats that rule so the unit page can say what is missing.

/** The values of the database check on units.amenities; labels live in the dictionary (listings.amenities). */
export const AMENITIES = ['parking', 'lift', 'air_conditioning', 'heating', 'sea_view', 'balcony', 'garden', 'security', 'equipped_kitchen'] as const;
export type Amenity = (typeof AMENITIES)[number];

/** Values of the database checks added by migration 0007; labels live in the dictionary (listings.*). */
export const CONDITIONS = ['new', 'excellent', 'good', 'to_refresh', 'to_renovate'] as const;
export const ORIENTATIONS = ['north', 'south', 'east', 'west'] as const;
export const LEGAL_STATUSES = ['titled', 'collective_title', 'untitled'] as const;
export const ENERGY_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
export const INCLUDED_CHARGES = ['water', 'electricity', 'gas', 'internet', 'syndic', 'heating'] as const;

/** Why a unit is not on the site; the dictionary has a sentence for each (listings.website.blockers). */
export type WebsiteBlocker = 'unit_archived' | 'property_archived' | 'hidden' | 'status' | 'no_rent' | 'no_sale_price' | 'no_photo';

export type WebsiteInput = {
  show_on_website: boolean;
  archived_at: string | null;
  status: string;
  rent_amount: number | string | null;
  sale_price: number | string | null;
  property: { archived_at: string | null };
  /** How many photos of the unit itself (the bien's photos are never published). */
  photoCount: number;
};

const isPositive = (value: number | string | null): boolean => value !== null && value !== '' && Number(value) > 0;

/** Everything that keeps the unit off the site, most blocking first; an empty list means it is online. */
export function websiteBlockers(unit: WebsiteInput): WebsiteBlocker[] {
  const blockers: WebsiteBlocker[] = [];
  if (unit.archived_at !== null) blockers.push('unit_archived');
  if (unit.property.archived_at !== null) blockers.push('property_archived');
  if (!unit.show_on_website) blockers.push('hidden');
  if (unit.status === 'vacant') {
    if (!isPositive(unit.rent_amount)) blockers.push('no_rent');
  } else if (unit.status === 'for_sale') {
    if (!isPositive(unit.sale_price)) blockers.push('no_sale_price');
  } else {
    blockers.push('status');
  }
  if (unit.photoCount === 0) blockers.push('no_photo');
  return blockers;
}

export const isOnWebsite = (unit: WebsiteInput): boolean => websiteBlockers(unit).length === 0;
