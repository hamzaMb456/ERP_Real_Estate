// Dashboard, properties (biens), units and common areas.
import type { Caller } from '../../domain/auth.ts';
import { MANAGER_ROLES } from '../../domain/auth.ts';
import { contactIdsInScope, unitIdsInScope } from '../../domain/access.ts';
import { todayTunis } from '../../domain/dates.ts';
import type { Item } from '../../domain/db.ts';
import { getItem, queryAll } from '../../domain/db.ts';
import { fail } from '../../domain/errors.ts';
import { leaseOverview } from '../../domain/lease-overview.ts';
import type { Lease } from '../../domain/lease-rules.ts';
import {
  createProperty, createUnit, deleteUnit, updateProperty, updateUnit,
} from '../../domain/places.ts';
import { recordGaps } from '../../domain/record-gaps.ts';
import { assertInScope, branchScope, inScope, priceChanges, scopedRows } from '../../domain/scope.ts';
import { matches, sortRows } from '../query-eval.ts';
import { active, activeLeaseByUnit, byOrg, contactsById, count, groupBy, ownerIds, ownersOf, photosOf } from '../org-data.ts';
import type { Op, Vars } from '../registry.ts';
import { EDITORS, REGIONAL, STAFF, WRITERS, mutation, query } from '../registry.ts';

const NAME = { name: 'asc' };
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Staff write only on records they can see; the manager and org_admin on any record of the organization. */
async function editable(model: 'Property' | 'Unit', caller: Caller, id: string): Promise<Item> {
  const current = await owned(model, caller, id);
  // Missing, foreign or outside the caller's branches all look the same: not found.
  if (!current) fail(model === 'Unit' ? 'unit_not_found' : 'out_of_scope');
  return current;
}

/** Staff may not move a property to another branch; only a manager may. */
function assertNoBranchMove(caller: Caller, current: Item, set: Item): void {
  if (!MANAGER_ROLES.has(caller.role) && 'branch_id' in set && set.branch_id !== current.branch_id) fail('branch_change_forbidden');
}

/** Staff may not change the prices of an existing unit; only a manager may. */
function assertNoPriceChange(caller: Caller, current: Item, set: Item): void {
  if (!MANAGER_ROLES.has(caller.role) && priceChanges(current, set).length > 0) fail('price_change_forbidden');
}

/** A record of the caller's organization that sits in a branch the caller may use (regional staff are narrowed). */
async function owned(model: string, caller: Caller, id: string): Promise<Item | null> {
  const item = await getItem(model, { id });
  if (item?.organization_id !== caller.orgId) return null;
  const scope = await branchScope(caller);
  if (scope === null) return item;
  const branchId = model === 'Unit' ? (await getItem('Property', { id: item.property_id as string }))?.branch_id : item.branch_id;
  return inScope(scope, branchId) ? item : null;
}

/** Properties and units the caller may see. A null scope (manager, org_admin, viewer) keeps everything. */
async function scopedOrg(caller: Caller, properties: Item[], units: Item[]): Promise<{ properties: Item[]; units: Item[] }> {
  const scope = await branchScope(caller);
  if (scope === null) return { properties, units };
  const kept = scopedRows(scope, properties, (p) => p.branch_id);
  const ids = new Set(kept.map((p) => p.id as string));
  return { properties: kept, units: units.filter((u) => ids.has(u.property_id as string)) };
}

const branchOf = (branches: Map<string, Item[]>, id: string) => {
  const b = branches.get(id)?.[0];
  return b ? { id: b.id, name: b.name } : null;
};

export const placeOps: Record<string, Op> = {
  Dashboard: query(REGIONAL, async (c, v) => {
    const [allProperties, allUnits, branches, allContacts, allLeases, allAppointments] = await Promise.all([
      byOrg('Property', c.orgId), byOrg('Unit', c.orgId), byOrg('Branch', c.orgId), byOrg('Contact', c.orgId), byOrg('Lease', c.orgId),
      queryAll('Appointment', { index: 'byOrgStart', key: 'organization_id', value: c.orgId, sortKey: { name: 'starts_at', condition: '#sk BETWEEN :a AND :b', values: { ':a': str(v.dayStart), ':b': str(v.dayEnd) } } }),
    ]);
    // Regional staff count only what is in their branches (a null set keeps everything).
    const { properties, units } = await scopedOrg(c, allProperties, allUnits);
    const unitSet = await unitIdsInScope(c);
    const contactSet = await contactIdsInScope(c, unitSet);
    const contacts = contactSet === null ? allContacts : allContacts.filter((x) => contactSet.has(x.id as string));
    const leases = unitSet === null
      ? allLeases
      : allLeases.filter((l) => {
        const ids = (l.unit_ids as string[] | undefined) ?? [];
        return ids.length > 0 && ids.every((id) => unitSet.has(id));
      });
    const appointments = unitSet === null
      ? allAppointments
      : allAppointments.filter((a) => (a.unit_id ? unitSet.has(a.unit_id as string) : a.assigned_user_id === c.userId));
    const propertyById = new Map(properties.map((p) => [p.id as string, p]));
    const branchById = groupBy(branches, 'id');
    const unitsBy = groupBy(active(units), 'property_id');
    const today = str(v.today) || todayTunis();
    const overview = leases.filter((l) => !l.archived_at).map((l) => leaseOverview(l as Lease, today));
    return {
      units: active(units).map((u) => ({ status: u.status, property: { branch: branchOf(branchById, propertyById.get(u.property_id)?.branch_id) } })),
      properties: sortRows(active(properties), NAME).slice(0, 5).map((p) => ({
        id: p.id, name: p.name, city: p.city, units: (unitsBy.get(p.id) ?? []).map((u) => ({ status: u.status, rent_amount: u.rent_amount })),
      })),
      contacts_aggregate: count(contacts.length),
      record_gaps_aggregate: count(recordGaps(properties, units, contacts).length),
      leases_to_renew: count(overview.filter((o) => o.is_ending_soon || o.in_grace || (o.status === 'active' && o.end_date < today)).length),
      registrations_due: count(overview.filter((o) => o.registration_state === 'due_soon' || o.registration_state === 'overdue').length),
      appointments_today: count(appointments.filter((a) => a.status === 'planned' && a.starts_at < str(v.dayEnd)).length),
    };
  }),

  PropertiesWithUnits: query(REGIONAL, async (c) => {
    const [allProperties, allUnits, branches, files] = await Promise.all([byOrg('Property', c.orgId), byOrg('Unit', c.orgId), byOrg('Branch', c.orgId), byOrg('FileLink', c.orgId)]);
    const { properties, units } = await scopedOrg(c, allProperties, allUnits);
    const contacts = await contactsById(ownerIds(units));
    const unitsBy = groupBy(units, 'property_id');
    const filesBy = groupBy(files, 'target_key');
    const branchById = groupBy(branches, 'id');
    return {
      properties: sortRows(properties, NAME).slice(0, 200).map((p) => ({
        id: p.id, name: p.name, type: p.type, address_line: p.address_line, city: p.city, archived_at: p.archived_at,
        branch: branchOf(branchById, p.branch_id),
        files: (filesBy.get(`property#${p.id}`) ?? []).filter((f) => f.is_cover).slice(0, 1).map((f) => ({ storage_file_id: f.storage_file_id })),
        units: sortRows(unitsBy.get(p.id) ?? [], { code: 'asc' }).map((u) => ({
          id: u.id, code: u.code, type: u.type, floor: u.floor, rooms: u.rooms, surface_m2: u.surface_m2, rent_amount: u.rent_amount,
          status: u.status, archived_at: u.archived_at, current_owners: ownersOf(u, contacts).map((o) => ({ contact: { id: o.contact.id, full_name: o.contact.full_name } })),
        })),
      })),
    };
  }),

  Property: query(REGIONAL, async (c, v) => {
    const p = await owned('Property', c, str(v.id));
    if (!p) return { property: null };
    const [units, branch] = await Promise.all([
      queryAll('Unit', { index: 'byProperty', key: 'property_id', value: p.id }),
      getItem('Branch', { id: p.branch_id }),
    ]);
    const ownerships = (await Promise.all(units.map((u) => queryAll('Ownership', { index: 'byUnit', key: 'unit_id', value: u.id })))).flat();
    const contacts = await contactsById(ownerIds(units));
    // property_owners: each current owner of the bien's active units, with how many units they hold.
    const owners = new Map<string, number>();
    for (const u of active(units)) for (const o of ownersOf(u, contacts)) owners.set(o.contact.id, (owners.get(o.contact.id) ?? 0) + 1);
    const ownershipsBy = groupBy(ownerships, 'unit_id');
    return {
      property: {
        id: p.id, name: p.name, type: p.type, address_line: p.address_line, city: p.city, governorate: p.governorate,
        postal_code: p.postal_code, latitude: p.latitude ?? null, longitude: p.longitude ?? null, archived_at: p.archived_at,
        branch: branch ? { id: branch.id, name: branch.name } : null,
        owners: [...owners.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => {
          const contact = contacts.get(id);
          return { units_count: n, contact: { id, full_name: contact?.full_name ?? '', is_organization: contact?.is_organization ?? false } };
        }),
        units: sortRows(units, { code: 'asc' }).map((u) => ({
          id: u.id, code: u.code, type: u.type, floor: u.floor, rooms: u.rooms, surface_m2: u.surface_m2, rent_amount: u.rent_amount,
          status: u.status, archived_at: u.archived_at,
          ownerships: (ownershipsBy.get(u.id) ?? []).map((o) => ({ id: o.id, unit_id: o.unit_id, contact_id: o.contact_id, share_percent: o.share_percent, starts_on: o.starts_on, ends_on: o.ends_on })),
          current_owners: ownersOf(u, contacts).map((o) => ({ share_percent: o.share_percent, contact: { id: o.contact.id, full_name: o.contact.full_name } })),
        })),
      },
    };
  }),

  PropertyForEdit: query(REGIONAL, async (c, v) => ({ property: await owned('Property', c, str(v.id)) })),

  PropertiesMap: query(REGIONAL, async (c) => {
    const [allProperties, allUnits, branches] = await Promise.all([byOrg('Property', c.orgId), byOrg('Unit', c.orgId), byOrg('Branch', c.orgId)]);
    const { properties, units } = await scopedOrg(c, allProperties, allUnits);
    const unitsBy = groupBy(active(units), 'property_id');
    const branchById = groupBy(branches, 'id');
    return {
      properties: sortRows(active(properties), NAME).map((p) => ({
        id: p.id, name: p.name, city: p.city, latitude: p.latitude, longitude: p.longitude, branch: branchOf(branchById, p.branch_id),
        units: (unitsBy.get(p.id) ?? []).map((u) => ({ status: u.status })),
      })),
    };
  }),

  ArchivedProperties: query(REGIONAL, async (c) => {
    const [allProperties, allUnits] = await Promise.all([byOrg('Property', c.orgId), byOrg('Unit', c.orgId)]);
    const { properties, units } = await scopedOrg(c, allProperties, allUnits);
    const unitsBy = groupBy(units, 'property_id');
    return {
      properties: sortRows(properties.filter((p) => p.archived_at), { archived_at: 'desc' }).map((p) => ({
        id: p.id, name: p.name, type: p.type, city: p.city, archived_at: p.archived_at, units_aggregate: count((unitsBy.get(p.id) ?? []).length),
      })),
    };
  }),

  Branches: query(REGIONAL, async (c) => {
    const scope = await branchScope(c);
    const branches = scopedRows(scope, await byOrg('Branch', c.orgId), (b) => b.id);
    return { branches: sortRows(branches, NAME).map((b) => ({ id: b.id, name: b.name, city: b.city })) };
  }),

  UnitsOverview: query(REGIONAL, async (c) => {
    const [allProperties, allUnits, files, leases] = await Promise.all([byOrg('Property', c.orgId), byOrg('Unit', c.orgId), byOrg('FileLink', c.orgId), byOrg('Lease', c.orgId)]);
    const { properties, units } = await scopedOrg(c, allProperties, allUnits);
    const contacts = await contactsById(ownerIds(units));
    const propertyById = new Map(properties.map((p) => [p.id as string, p]));
    const filesBy = groupBy(files, 'target_key');
    const leaseOf = activeLeaseByUnit(leases);
    const rows = units.map((u) => ({ ...u, property: propertyById.get(u.property_id) }));
    return {
      units: sortRows(rows, [{ property: { name: 'asc' } }, { code: 'asc' }]).slice(0, 500).map((u) => {
        const photos = photosOf(filesBy.get(`unit#${u.id}`));
        const lease = leaseOf.get(u.id);
        const p = u.property;
        return {
          id: u.id, code: u.code, type: u.type, floor: u.floor, rooms: u.rooms, surface_m2: u.surface_m2, rent_amount: u.rent_amount,
          sale_price: u.sale_price, status: u.status, archived_at: u.archived_at, show_on_website: u.show_on_website, title: u.title,
          property: p ? { id: p.id, name: p.name, city: p.city, archived_at: p.archived_at } : null,
          photos: photos.slice(0, 1).map((f) => ({ storage_file_id: f.storage_file_id })),
          photoCount: count(photos.length),
          // current_lease is an array relationship (a unit can, in theory, have several concurrent leases).
          current_lease: lease ? [{ renter_names: (lease.party_names as string[] | undefined)?.join(', ') ?? null, end_date: lease.end_date }] : [],
          current_owners: ownersOf(u, contacts).map((o) => ({ contact: { id: o.contact.id, full_name: o.contact.full_name } })),
        };
      }),
      properties: sortRows(properties, NAME).slice(0, 500).map((p) => ({ id: p.id, name: p.name, type: p.type, archived_at: p.archived_at })),
    };
  }),

  Unit: query(REGIONAL, async (c, v) => {
    const u = await owned('Unit', c, str(v.id));
    if (!u) return { unit: null };
    const [property, files] = await Promise.all([
      getItem('Property', { id: u.property_id }),
      queryAll('FileLink', { index: 'byTarget', key: 'target_key', value: `unit#${u.id}` }),
    ]);
    return {
      unit: {
        ...u, property: property ? { id: property.id, name: property.name, archived_at: property.archived_at } : null,
        photos: count(files.filter((f) => f.kind === 'photo').length),
      },
    };
  }),

  AddProperty: mutation(EDITORS, async (c, v) => {
    const object = v.object as Item;
    assertInScope(await branchScope(c), object.branch_id);
    return { insert_properties_one: { id: (await createProperty(c, object)).id } };
  }),
  UpdateProperty: mutation(EDITORS, async (c, v) => {
    const current = await editable('Property', c, str(v.id));
    assertNoBranchMove(c, current, v.set as Item);
    return { update_properties_by_pk: { id: (await updateProperty(c, str(v.id), v.set as Item)).id } };
  }),
  SetPropertyArchived: mutation(EDITORS, async (c, v) => {
    await editable('Property', c, str(v.id));
    return { update_properties_by_pk: { id: (await updateProperty(c, str(v.id), { archived_at: v.archived_at ?? null })).id } };
  }),
  RestoreProperty: mutation(EDITORS, async (c, v) => {
    await editable('Property', c, str(v.id));
    return { update_properties_by_pk: { id: (await updateProperty(c, str(v.id), { archived_at: null })).id } };
  }),
  AddUnit: mutation(EDITORS, async (c, v) => {
    const object = v.object as Item;
    await editable('Property', c, str(object.property_id));
    return { insert_units_one: { id: (await createUnit(c, object)).id } };
  }),
  UpdateUnit: mutation(EDITORS, async (c, v) => {
    const current = await editable('Unit', c, str(v.id));
    const set = v.set as Item;
    assertNoPriceChange(c, current, set);
    // Moving a unit to another property moves it to that property's branch: the target must be in scope too.
    if (set.property_id !== undefined && set.property_id !== current.property_id) await editable('Property', c, str(set.property_id));
    return { update_units_by_pk: { id: (await updateUnit(c, str(v.id), v.set as Item)).id } };
  }),
  DeleteUnit: mutation(WRITERS, async (c, v) => {
    await deleteUnit(c, str(v.id));
    return { delete_units_by_pk: { id: str(v.id) } };
  }),
  SetUnitVisibility: mutation(EDITORS, async (c, v) => {
    await editable('Unit', c, str(v.id));
    return { update_units_by_pk: { id: (await updateUnit(c, str(v.id), { show_on_website: Boolean(v.show) })).id } };
  }),
};

export { matches };
