// The website's read model (was the public_listings / public_listing_photos views): one
// PublicListing per unit on the website, rewritten whenever its unit, property, photos or
// organization change, and fully resynced by the daily job as a safety net.
import { DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Item } from './db.ts';
import { doc, getItem, queryAll, scanAll, table } from './db.ts';

const round3 = (n: number | null | undefined): number | null => (n == null ? null : Math.round(n * 1000) / 1000);

/** Cover first, then sort order; created_at and id break ties so the cover never flips. */
function orderPhotos(files: Item[]): Item[] {
  return files
    .filter((f) => f.kind === 'photo')
    .sort((a, b) => Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover))
      || (a.sort_order ?? 0) - (b.sort_order ?? 0)
      || String(a.created_at).localeCompare(String(b.created_at))
      || String(a.id).localeCompare(String(b.id)));
}

/** The listing of a unit, or null when it must not be on the website. Coordinates rounded (~100 m). */
export function buildPublicListing(unit: Item, property: Item | undefined, org: Item | undefined, files: Item[]): Item | null {
  if (!unit.show_on_website || unit.archived_at || !property || property.archived_at) return null;
  const forSale = unit.status === 'for_sale';
  const listable = (unit.status === 'vacant' && unit.rent_amount > 0) || (forSale && unit.sale_price > 0);
  const photos = orderPhotos(files);
  if (!listable || photos.length === 0) return null;
  return {
    id: unit.id,
    organization_id: unit.organization_id,
    unit_id: unit.id,
    kind: forSale ? 'sale' : 'rent',
    title: unit.title?.trim() || `${property.name} - ${unit.code}`,
    description: unit.description ?? null,
    price: forSale ? unit.sale_price : unit.rent_amount,
    charges: forSale ? null : unit.charges ?? null,
    deposit_months: unit.deposit_months ?? null,
    reservation_deposit: unit.reservation_deposit ?? null,
    reservation_days: unit.reservation_days ?? null,
    available_from: unit.available_from ?? null,
    furnished: unit.furnished ?? null,
    amenities: unit.amenities ?? null,
    virtual_tour_url: unit.virtual_tour_url ?? null,
    // byOrg sort key: DynamoDB rejects an explicit null there, so a missing date is omitted.
    published_at: unit.created_at ?? undefined,
    unit_type: unit.type ?? null,
    rooms: unit.rooms ?? null,
    surface_m2: unit.surface_m2 ?? null,
    floor: unit.floor ?? null,
    unit_status: unit.status,
    city: property.city ?? null,
    governorate: property.governorate ?? null,
    latitude: round3(property.latitude),
    longitude: round3(property.longitude),
    cover_file_id: photos[0].storage_file_id,
    photo_count: photos.length,
    photos: photos.map((p, i) => ({ storage_file_id: p.storage_file_id, position: i + 1 })),
    bedrooms: unit.bedrooms ?? null,
    bathrooms: unit.bathrooms ?? null,
    parking_spaces: unit.parking_spaces ?? null,
    property_condition: unit.property_condition ?? null,
    pets_allowed: unit.pets_allowed ?? null,
    legal_status: unit.legal_status ?? null,
    orientation: unit.orientation ?? null,
    outdoor_area_m2: unit.outdoor_area_m2 ?? null,
    energy_class: unit.energy_class ?? null,
    min_lease_months: unit.min_lease_months ?? null,
    charges_included: unit.charges_included ?? null,
    year_built: property.year_built ?? null,
    floors_count: property.floors_count ?? null,
    neighbourhood_description: property.neighbourhood_description ?? null,
    visit_fee: unit.visit_fee ?? null,
    visit_payment_method: org?.visit_payment_method ?? null,
  };
}

/** Rewrite (or remove) the listing of one unit. */
export async function syncPublicListing(unitId: string): Promise<'listed' | 'unlisted'> {
  const unit = await getItem('Unit', { id: unitId });
  const [property, org, files] = unit
    ? await Promise.all([
      getItem('Property', { id: unit.property_id }),
      getItem('Organization', { id: unit.organization_id }),
      queryAll('FileLink', { index: 'byTarget', key: 'target_key', value: `unit#${unitId}` }),
    ])
    : [undefined, undefined, []];
  const listing = unit ? buildPublicListing(unit, property, org, files) : null;
  if (!listing) {
    await doc.send(new DeleteCommand({ TableName: table('PublicListing'), Key: { id: unitId } }));
    return 'unlisted';
  }
  const now = new Date().toISOString();
  await doc.send(new PutCommand({
    TableName: table('PublicListing'),
    Item: { __typename: 'PublicListing', ...listing, created_at: now, updated_at: now },
  }));
  return 'listed';
}

export async function syncPublicListingsFor(index: 'byProperty' | 'byOrg', value: string): Promise<void> {
  const key = index === 'byProperty' ? 'property_id' : 'organization_id';
  const units = await queryAll('Unit', { index, key, value });
  for (const unit of units) await syncPublicListing(unit.id);
}

/** Daily safety net: every unit resynced, listings of deleted units removed. */
export async function resyncAllPublicListings(): Promise<{ listed: number; failed: string[] }> {
  const [units, listings] = await Promise.all([scanAll('Unit'), scanAll('PublicListing')]);
  const unitIds = new Set(units.map((u) => u.id as string));
  const failed: string[] = [];
  let listed = 0;
  for (const id of [...unitIds, ...listings.map((l) => l.id as string).filter((id) => !unitIds.has(id))]) {
    try {
      if ((await syncPublicListing(id)) === 'listed') listed += 1;
    } catch (err) {
      console.error(`resyncAllPublicListings: unit ${id} failed:`, (err as Error).message);
      failed.push(id);
    }
  }
  return { listed, failed };
}
