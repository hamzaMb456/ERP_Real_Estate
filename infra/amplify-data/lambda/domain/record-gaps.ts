// The record_gaps view ("Fiches incomplètes"): one row per missing piece of information.
import type { Item } from './db.ts';

export interface Gap {
  organization_id: string;
  entity_type: 'unit' | 'property' | 'contact';
  entity_id: string;
  property_id: string | null;
  entity_label: string;
  property_label: string | null;
  gap_code: string;
}

const blank = (v: unknown): boolean => typeof v !== 'string' || v.trim() === '';

export function recordGaps(properties: Item[], units: Item[], contacts: Item[]): Gap[] {
  const gaps: Gap[] = [];
  const activeProperties = new Map(properties.filter((p) => !p.archived_at).map((p) => [p.id as string, p]));
  const activeUnits = units.filter((u) => !u.archived_at && activeProperties.has(u.property_id));
  const unitGap = (u: Item, code: string) => gaps.push({
    organization_id: u.organization_id, entity_type: 'unit', entity_id: u.id, property_id: u.property_id,
    entity_label: u.code, property_label: activeProperties.get(u.property_id)?.name ?? null, gap_code: code,
  });
  const propertyGap = (p: Item, code: string) => gaps.push({
    organization_id: p.organization_id, entity_type: 'property', entity_id: p.id, property_id: p.id,
    entity_label: p.name, property_label: null, gap_code: code,
  });

  for (const u of activeUnits) if (!(u.current_owners as unknown[] | undefined)?.length) unitGap(u, 'no_owner');
  for (const u of activeUnits) if (u.surface_m2 == null) unitGap(u, 'no_surface');
  for (const u of activeUnits) if (u.rent_amount == null && (u.status === 'vacant' || u.status === 'rented')) unitGap(u, 'no_rent');
  for (const p of activeProperties.values()) if (blank(p.address_line) || blank(p.city)) propertyGap(p, 'no_address');
  for (const p of activeProperties.values()) if (p.latitude == null || p.longitude == null) propertyGap(p, 'no_position');
  for (const c of contacts) {
    if (!c.archived_at && !c.is_organization && blank(c.email) && blank(c.phone)) {
      gaps.push({ organization_id: c.organization_id, entity_type: 'contact', entity_id: c.id, property_id: null, entity_label: c.full_name, property_label: null, gap_code: 'no_contact_info' });
    }
  }
  return gaps;
}
