// The « Unités » overview: what a unit card shows and how the page filters its cards.

import { websiteBlockers, type WebsiteBlocker } from '@/lib/website';

/** One unit as the overview query returns it. */
export type UnitCardData = {
  id: string;
  code: string;
  type: string;
  floor: number | null;
  rooms: number | null;
  surface_m2: number | string | null;
  rent_amount: number | string | null;
  sale_price: number | string | null;
  status: string;
  archived_at: string | null;
  show_on_website: boolean;
  title: string | null;
  property: { id: string; name: string; city: string | null; archived_at: string | null };
  /** The cover photo first (at most one row). */
  photos: { storage_file_id: string }[];
  photoCount: { aggregate: { count: number } | null };
  current_lease: { renter_names: string | null; end_date: string }[];
  current_owners: { contact: { id: string; full_name: string } }[];
};

export type WebsiteFilter = 'all' | 'online' | 'offline';

/** « B-203 · Les Jardins de Carthage »: the admin identifies a unit by its reference and its bien. */
export function unitHeading(unit: Pick<UnitCardData, 'code' | 'property'>): string {
  return `${unit.code} · ${unit.property.name}`;
}

/** What keeps the unit off the website, most blocking first; empty when it is online. */
export function unitBlockers(unit: UnitCardData): WebsiteBlocker[] {
  return websiteBlockers({ ...unit, photoCount: unit.photoCount.aggregate?.count ?? 0 });
}

/** The price the card shows: the sale price of a unit for sale, the monthly rent otherwise. */
export function unitPrice(unit: Pick<UnitCardData, 'status' | 'rent_amount' | 'sale_price'>): { amount: number | string | null; monthly: boolean } {
  return unit.status === 'for_sale' ? { amount: unit.sale_price, monthly: false } : { amount: unit.rent_amount, monthly: true };
}

/** Free-text search over the reference, titles, the bien and its city, the tenants and the owners. */
export function unitMatches(unit: UnitCardData, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === '') return true;
  const haystack = [
    unit.code,
    unit.title,
    unit.property.name,
    unit.property.city,
    ...unit.current_lease.map((lease) => lease.renter_names),
    ...unit.current_owners.map((owner) => owner.contact.full_name),
  ];
  return haystack.some((value) => (value ?? '').toLowerCase().includes(needle));
}

export type UnitFilters = { search: string; status: string; propertyId: string; website: WebsiteFilter; showArchived: boolean };

export function filterUnits(units: UnitCardData[], filters: UnitFilters): UnitCardData[] {
  return units.filter((unit) => {
    if (!filters.showArchived && (unit.archived_at !== null || unit.property.archived_at !== null)) return false;
    if (filters.status !== 'all' && unit.status !== filters.status) return false;
    if (filters.propertyId !== 'all' && unit.property.id !== filters.propertyId) return false;
    if (filters.website !== 'all' && (unitBlockers(unit).length === 0) !== (filters.website === 'online')) return false;
    return unitMatches(unit, filters.search);
  });
}
