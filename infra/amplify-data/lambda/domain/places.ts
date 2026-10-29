// Properties (biens), units and common areas: the column checks of 0001/0002/0006/0007, the unique
// unit code among active units, and the single unit a house or a plot gets automatically.
import { randomUUID } from 'node:crypto';
import type { Caller } from './auth.ts';
import { requireWriter } from './auth.ts';
import { isIsoDate } from './dates.ts';
import { fail } from './errors.ts';
import type { Item, TxItem } from './db.ts';
import { getItem, queryAll, table, transact } from './db.ts';
import { syncPublicListing, syncPublicListingsFor } from './public-listings.ts';

type Rule = {
  enum?: readonly string[];
  subset?: readonly string[];
  min?: number;
  max?: number;
  gt?: number;
  int?: boolean;
  text?: boolean;
  nonEmpty?: boolean;
  bool?: boolean;
  date?: boolean;
  url?: boolean;
  id?: boolean;
  timestamp?: boolean;
};

const AMENITIES = ['parking', 'lift', 'air_conditioning', 'heating', 'sea_view', 'balcony', 'garden', 'security', 'equipped_kitchen'];
const ORIENTATIONS = ['north', 'south', 'east', 'west'];
const CHARGES_INCLUDED = ['water', 'electricity', 'gas', 'internet', 'syndic', 'heating'];

export const PROPERTY_RULES: Record<string, Rule> = {
  name: { text: true, nonEmpty: true }, branch_id: { id: true }, address_line: { text: true }, city: { text: true },
  governorate: { text: true }, postal_code: { text: true }, latitude: { min: -90, max: 90 }, longitude: { min: -180, max: 180 },
  year_built: { int: true, min: 1800, max: 2100 }, floors_count: { int: true, min: 1, max: 200 },
  neighbourhood_description: { text: true }, archived_at: { timestamp: true },
};

export const UNIT_RULES: Record<string, Rule> = {
  code: { text: true, nonEmpty: true },
  type: { enum: ['apartment', 'office', 'shop', 'parking', 'house', 'land'] },
  status: { enum: ['vacant', 'rented', 'for_sale', 'sold', 'under_maintenance'] },
  floor: { int: true }, rooms: { int: true, min: 0 }, surface_m2: { gt: 0 }, rent_amount: { min: 0 },
  title: { text: true, nonEmpty: true }, description: { text: true }, sale_price: { gt: 0 }, charges: { min: 0 },
  available_from: { date: true }, furnished: { bool: true }, amenities: { subset: AMENITIES }, show_on_website: { bool: true },
  bedrooms: { int: true, min: 0, max: 50 }, bathrooms: { int: true, min: 0, max: 50 }, parking_spaces: { int: true, min: 0, max: 50 },
  property_condition: { enum: ['new', 'excellent', 'good', 'to_refresh', 'to_renovate'] },
  deposit_months: { int: true, min: 0, max: 12 }, pets_allowed: { bool: true },
  legal_status: { enum: ['titled', 'collective_title', 'untitled'] }, virtual_tour_url: { url: true },
  orientation: { subset: ORIENTATIONS }, outdoor_area_m2: { gt: 0 }, energy_class: { enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
  min_lease_months: { int: true, min: 1, max: 120 }, charges_included: { subset: CHARGES_INCLUDED },
  reservation_deposit: { min: 0 }, reservation_days: { int: true, min: 1, max: 90 }, common_share: { int: true, min: 0, max: 1000 },
  visit_fee: { min: 0 }, archived_at: { timestamp: true },
};

const AREA_RULES: Record<string, Rule> = {
  name: { text: true, nonEmpty: true }, kind: { enum: ['stairs', 'lift', 'garden', 'roof', 'parking', 'other'] }, notes: { text: true },
};

function valid(rule: Rule, v: unknown): boolean {
  if (v === null) return !rule.nonEmpty;
  if (rule.enum) return rule.enum.includes(v as string);
  if (rule.subset) return Array.isArray(v) && v.every((x) => rule.subset!.includes(x));
  if (rule.bool) return typeof v === 'boolean';
  if (rule.date) return isIsoDate(v);
  if (rule.timestamp) return typeof v === 'string' && !Number.isNaN(Date.parse(v));
  if (rule.id) return typeof v === 'string' && v !== '';
  if (rule.url) return typeof v === 'string' && /^https?:\/\//i.test(v);
  if (rule.text) return typeof v === 'string' && (!rule.nonEmpty || v.trim() !== '');
  if (typeof v !== 'number' || !Number.isFinite(v)) return false;
  return (!rule.int || Number.isInteger(v)) && (rule.min === undefined || v >= rule.min)
    && (rule.max === undefined || v <= rule.max) && (rule.gt === undefined || v > rule.gt);
}

/** Only known columns, each checked (constraint names as in Postgres: <table>_<column>_check). */
export function checkColumns(tableName: string, rules: Record<string, Rule>, patch: Item): Item {
  const out: Item = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (!(key in rules)) fail(`${tableName}_column_not_writable:${key}`);
    if (!valid(rules[key], value)) fail(`${tableName}_${key}_check`);
    out[key] = typeof value === 'string' && rules[key].text ? value.trim() : value;
  }
  return out;
}

const codeLockId = (propertyId: string, code: string): string => `UNIQ#unitcode#${propertyId}#${code}`;
const now = (): string => new Date().toISOString();

function lockCode(unit: Item): TxItem {
  return {
    Put: {
      TableName: table('Lock'),
      Item: { __typename: 'Lock', id: codeLockId(unit.property_id, unit.code), unit_id: unit.id },
      ConditionExpression: 'attribute_not_exists(id)',
    },
  };
}

const putIfUnchanged = (model: string, next: Item, seen?: string): TxItem => ({
  Put: {
    TableName: table(model),
    Item: { __typename: model, ...next },
    ...(seen === undefined
      ? { ConditionExpression: 'attribute_not_exists(id)' }
      : { ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': seen } }),
  },
});

async function loadOwned(model: string, orgId: string, id: string, missing: string): Promise<Item> {
  const item = await getItem(model, { id });
  if (item?.organization_id !== orgId) fail(missing);
  return item;
}

// ------------------------------------------------------------------ properties

/** A house or a plot gets its single unit (create_single_unit). */
export async function createProperty(caller: Caller, object: Item): Promise<Item> {
  const orgId = requireWriter(caller, 'permission_denied');
  const type = object.type ?? 'building';
  if (!['building', 'house', 'plot'].includes(type)) fail('properties_type_check');
  const { type: _type, ...rest } = object;
  const columns = checkColumns('properties', PROPERTY_RULES, rest);
  if (!columns.name) fail('properties_name_check');
  await loadOwned('Branch', orgId, columns.branch_id, 'branch_not_found');
  const at = now();
  const property = { id: randomUUID(), organization_id: orgId, type, ...columns, archived_at: null, created_at: at, updated_at: at };
  const items: TxItem[] = [putIfUnchanged('Property', property)];
  if (type !== 'building') {
    const unit = {
      id: randomUUID(), organization_id: orgId, property_id: property.id, code: type === 'house' ? 'MAISON' : 'TERRAIN',
      type: type === 'house' ? 'house' : 'land', status: 'vacant', deposit_months: 2, reservation_deposit: 10000,
      reservation_days: 15, amenities: [], orientation: [], charges_included: [], show_on_website: false,
      archived_at: null, created_at: at, updated_at: at,
    };
    items.push(putIfUnchanged('Unit', unit), lockCode(unit));
  }
  await transact(items);
  return property;
}

/** Any column but the type (a building never becomes a house). */
export async function updateProperty(caller: Caller, id: string, set: Item): Promise<Item> {
  const orgId = requireWriter(caller, 'permission_denied');
  const current = await loadOwned('Property', orgId, id, 'property_not_found');
  const columns = checkColumns('properties', PROPERTY_RULES, set);
  if (columns.branch_id && columns.branch_id !== current.branch_id) await loadOwned('Branch', orgId, columns.branch_id, 'branch_not_found');
  const next = { ...current, ...columns, updated_at: now() };
  await transact([putIfUnchanged('Property', next, current.updated_at)]);
  // City, position or archiving change what the website shows for every unit of the bien.
  await syncPublicListingsFor('byProperty', id);
  return next;
}

// ------------------------------------------------------------------ units

export async function createUnit(caller: Caller, object: Item): Promise<Item> {
  const orgId = requireWriter(caller, 'permission_denied');
  const { property_id: propertyId, ...rest } = object;
  await loadOwned('Property', orgId, propertyId, 'property_not_found');
  const columns = checkColumns('units', UNIT_RULES, rest);
  if (!columns.code) fail('units_code_check');
  const at = now();
  const unit = {
    id: randomUUID(), organization_id: orgId, property_id: propertyId, type: 'apartment', status: 'vacant',
    deposit_months: 2, reservation_deposit: 10000, reservation_days: 15, amenities: [], orientation: [], charges_included: [],
    show_on_website: false, ...columns, archived_at: null, created_at: at, updated_at: at,
  };
  await transact([putIfUnchanged('Unit', unit), lockCode(unit)], 'units_property_id_code_key');
  return unit;
}

/** units_property_id_code_key holds among active units only: archiving frees the code. */
export async function updateUnit(caller: Caller, id: string, set: Item): Promise<Item> {
  const orgId = requireWriter(caller, 'permission_denied');
  const current = await loadOwned('Unit', orgId, id, 'unit_not_found');
  const next = { ...current, ...checkColumns('units', UNIT_RULES, set), updated_at: now() };
  const wasActive = !current.archived_at;
  const isActive = !next.archived_at;
  const sameSlot = current.code === next.code;
  const items: TxItem[] = [putIfUnchanged('Unit', next, current.updated_at)];
  if (wasActive && !(isActive && sameSlot)) items.push({ Delete: { TableName: table('Lock'), Key: { id: codeLockId(current.property_id, current.code) } } });
  if (isActive && !(wasActive && sameSlot)) items.push(lockCode(next));
  await transact(items, 'units_property_id_code_key');
  await syncPublicListing(id);
  return next;
}

/**
 * Hard delete, for mistaken or mock rows only: a unit nothing references. A unit tied to a lease,
 * an ownership, a request or an appointment is refused (archive it instead) so no history is
 * orphaned. The unit's file links, public listing and code lock go with it, in one transaction.
 */
export async function deleteUnit(caller: Caller, id: string): Promise<void> {
  const orgId = requireWriter(caller, 'permission_denied');
  const unit = await loadOwned('Unit', orgId, id, 'unit_not_found');
  const [junctions, leases, ownerships, visits, rentals, appointments, files] = await Promise.all([
    queryAll('LeaseUnit', { index: 'byUnit', key: 'unit_id', value: id }),
    queryAll('Lease', { index: 'byOrg', key: 'organization_id', value: orgId }),
    queryAll('Ownership', { index: 'byUnit', key: 'unit_id', value: id }),
    queryAll('VisitRequest', { index: 'byUnit', key: 'unit_id', value: id }),
    queryAll('RentalRequest', { index: 'byOrg', key: 'organization_id', value: orgId }),
    queryAll('Appointment', { index: 'byOrgStart', key: 'organization_id', value: orgId }),
    queryAll('FileLink', { index: 'byTarget', key: 'target_key', value: `unit#${id}` }),
  ]);
  const referenced =
    junctions.length > 0 ||
    leases.some((l) => ((l.unit_ids as string[] | undefined) ?? []).includes(id)) ||
    ownerships.length > 0 ||
    visits.length > 0 ||
    rentals.some((r) => r.unit_id === id) ||
    appointments.some((a) => a.unit_id === id);
  if (referenced) fail('unit_not_deletable');
  const items: TxItem[] = [
    {
      Delete: {
        TableName: table('Unit'), Key: { id },
        ConditionExpression: 'organization_id = :org', ExpressionAttributeValues: { ':org': orgId },
      },
    },
    ...files.map((f) => ({ Delete: { TableName: table('FileLink'), Key: { id: f.id } } }) as TxItem),
    { Delete: { TableName: table('PublicListing'), Key: { id } } },
    { Delete: { TableName: table('Lock'), Key: { id: codeLockId(unit.property_id as string, unit.code as string) } } },
  ];
  await transact(items);
}

/** update_units_many for the syndic shares table: common_share only. */
export async function saveShares(caller: Caller, updates: { id: string; common_share: number | null }[]): Promise<number> {
  const orgId = requireWriter(caller, 'permission_denied');
  if (updates.length > 90) fail('units_too_many_updates');
  const at = now();
  await transact(updates.map((u) => {
    checkColumns('units', UNIT_RULES, { common_share: u.common_share });
    return {
      Update: {
        TableName: table('Unit'),
        Key: { id: u.id },
        UpdateExpression: 'SET common_share = :s, updated_at = :now',
        ConditionExpression: 'organization_id = :org',
        ExpressionAttributeValues: { ':s': u.common_share, ':now': at, ':org': orgId },
      },
    } as TxItem;
  }), 'unit_not_found');
  return updates.length;
}

// ------------------------------------------------------------------ common areas

export async function createCommonArea(caller: Caller, object: Item): Promise<Item> {
  const orgId = requireWriter(caller, 'permission_denied');
  const { property_id: propertyId, ...rest } = object;
  await loadOwned('Property', orgId, propertyId, 'property_not_found');
  const columns = checkColumns('common_areas', AREA_RULES, rest);
  if (!columns.name) fail('common_areas_name_check');
  const at = now();
  const area = { id: randomUUID(), organization_id: orgId, property_id: propertyId, kind: 'other', ...columns, created_at: at, updated_at: at };
  await transact([putIfUnchanged('CommonArea', area)]);
  return area;
}

export async function updateCommonArea(caller: Caller, id: string, set: Item): Promise<Item> {
  const orgId = requireWriter(caller, 'permission_denied');
  const current = await loadOwned('CommonArea', orgId, id, 'common_area_not_found');
  const next = { ...current, ...checkColumns('common_areas', AREA_RULES, set), updated_at: now() };
  await transact([putIfUnchanged('CommonArea', next, current.updated_at)]);
  return next;
}

export async function deleteCommonArea(caller: Caller, id: string): Promise<void> {
  const orgId = requireWriter(caller, 'permission_denied');
  await loadOwned('CommonArea', orgId, id, 'common_area_not_found');
  await transact([{ Delete: { TableName: table('CommonArea'), Key: { id }, ConditionExpression: 'organization_id = :org', ExpressionAttributeValues: { ':org': orgId } } }]);
}
