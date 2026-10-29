// Dashboard, properties (biens), units and common areas.
import type { Caller } from '../../domain/auth.ts';
import { todayTunis } from '../../domain/dates.ts';
import type { Item } from '../../domain/db.ts';
import { getItem, queryAll } from '../../domain/db.ts';
import { fail } from '../../domain/errors.ts';
import { leaseOverview } from '../../domain/lease-overview.ts';
import type { Lease } from '../../domain/lease-rules.ts';
import {
  createCommonArea, createProperty, createUnit, deleteCommonArea, deleteUnit, saveShares, updateCommonArea, updateProperty, updateUnit,
} from '../../domain/places.ts';
import { recordGaps } from '../../domain/record-gaps.ts';
import { matches, sortRows } from '../query-eval.ts';
import { active, activeLeaseByUnit, byOrg, contactsById, count, groupBy, ownerIds, ownersOf, photosOf } from '../org-data.ts';
import type { Op, Vars } from '../registry.ts';
import { STAFF, WRITERS, mutation, query } from '../registry.ts';

const NAME = { name: 'asc' };
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

async function owned(model: string, caller: Caller, id: string): Promise<Item | null> {
  const item = await getItem(model, { id });
  return item?.organization_id === caller.orgId ? item : null;
}

const branchOf = (branches: Map<string, Item[]>, id: string) => {
  const b = branches.get(id)?.[0];
  return b ? { id: b.id, name: b.name } : null;
};

export const placeOps: Record<string, Op> = {
  Dashboard: query(STAFF, async (c, v) => {
    const [properties, units, branches, contacts, leases, appointments] = await Promise.all([
      byOrg('Property', c.orgId), byOrg('Unit', c.orgId), byOrg('Branch', c.orgId), byOrg('Contact', c.orgId), byOrg('Lease', c.orgId),
      queryAll('Appointment', { index: 'byOrgStart', key: 'organization_id', value: c.orgId, sortKey: { name: 'starts_at', condition: '#sk BETWEEN :a AND :b', values: { ':a': str(v.dayStart), ':b': str(v.dayEnd) } } }),
    ]);
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

  PropertiesWithUnits: query(STAFF, async (c) => {
    const [properties, units, branches, files] = await Promise.all([byOrg('Property', c.orgId), byOrg('Unit', c.orgId), byOrg('Branch', c.orgId), byOrg('FileLink', c.orgId)]);
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

  Property: query(STAFF, async (c, v) => {
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
          status: u.status, archived_at: u.archived_at, common_share: u.common_share,
          ownerships: (ownershipsBy.get(u.id) ?? []).map((o) => ({ id: o.id, unit_id: o.unit_id, contact_id: o.contact_id, share_percent: o.share_percent, starts_on: o.starts_on, ends_on: o.ends_on })),
          current_owners: ownersOf(u, contacts).map((o) => ({ share_percent: o.share_percent, contact: { id: o.contact.id, full_name: o.contact.full_name } })),
        })),
      },
    };
  }),

  PropertyForEdit: query(STAFF, async (c, v) => ({ property: await owned('Property', c, str(v.id)) })),

  PropertiesMap: query(STAFF, async (c) => {
    const [properties, units, branches] = await Promise.all([byOrg('Property', c.orgId), byOrg('Unit', c.orgId), byOrg('Branch', c.orgId)]);
    const unitsBy = groupBy(active(units), 'property_id');
    const branchById = groupBy(branches, 'id');
    return {
      properties: sortRows(active(properties), NAME).map((p) => ({
        id: p.id, name: p.name, city: p.city, latitude: p.latitude, longitude: p.longitude, branch: branchOf(branchById, p.branch_id),
        units: (unitsBy.get(p.id) ?? []).map((u) => ({ status: u.status })),
      })),
    };
  }),

  ArchivedProperties: query(STAFF, async (c) => {
    const [properties, units] = await Promise.all([byOrg('Property', c.orgId), byOrg('Unit', c.orgId)]);
    const unitsBy = groupBy(units, 'property_id');
    return {
      properties: sortRows(properties.filter((p) => p.archived_at), { archived_at: 'desc' }).map((p) => ({
        id: p.id, name: p.name, type: p.type, city: p.city, archived_at: p.archived_at, units_aggregate: count((unitsBy.get(p.id) ?? []).length),
      })),
    };
  }),

  Branches: query(STAFF, async (c) => ({
    branches: sortRows(await byOrg('Branch', c.orgId), NAME).map((b) => ({ id: b.id, name: b.name, city: b.city })),
  })),

  UnitsOverview: query(STAFF, async (c) => {
    const [properties, units, files, leases] = await Promise.all([byOrg('Property', c.orgId), byOrg('Unit', c.orgId), byOrg('FileLink', c.orgId), byOrg('Lease', c.orgId)]);
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

  Unit: query(STAFF, async (c, v) => {
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

  CommonAreas: query(STAFF, async (c, v) => {
    const property = await owned('Property', c, str(v.propertyId));
    if (!property) return { common_areas: [] };
    const areas = await queryAll('CommonArea', { index: 'byProperty', key: 'property_id', value: property.id });
    return { common_areas: sortRows(areas, NAME).map((a) => ({ id: a.id, name: a.name, kind: a.kind, notes: a.notes })) };
  }),

  CommonAreasOverview: query(STAFF, async (c) => {
    const [properties, units, areas] = await Promise.all([byOrg('Property', c.orgId), byOrg('Unit', c.orgId), Promise.resolve([] as Item[])]);
    const buildings = sortRows(active(properties).filter((p) => p.type === 'building'), NAME);
    const areaCounts = await Promise.all(buildings.map((p) => queryAll('CommonArea', { index: 'byProperty', key: 'property_id', value: p.id })));
    const unitsBy = groupBy(active(units), 'property_id');
    void areas;
    return {
      properties: buildings.map((p, i) => ({
        id: p.id, name: p.name, city: p.city, common_areas_aggregate: count(areaCounts[i].length),
        units: (unitsBy.get(p.id) ?? []).map((u) => ({ common_share: u.common_share })),
      })),
    };
  }),

  AddProperty: mutation(WRITERS, async (c, v) => ({ insert_properties_one: { id: (await createProperty(c, v.object as Item)).id } })),
  UpdateProperty: mutation(WRITERS, async (c, v) => ({ update_properties_by_pk: { id: (await updateProperty(c, str(v.id), v.set as Item)).id } })),
  SetPropertyArchived: mutation(WRITERS, async (c, v) => ({ update_properties_by_pk: { id: (await updateProperty(c, str(v.id), { archived_at: v.archived_at ?? null })).id } })),
  RestoreProperty: mutation(WRITERS, async (c, v) => ({ update_properties_by_pk: { id: (await updateProperty(c, str(v.id), { archived_at: null })).id } })),
  AddUnit: mutation(WRITERS, async (c, v) => ({ insert_units_one: { id: (await createUnit(c, v.object as Item)).id } })),
  UpdateUnit: mutation(WRITERS, async (c, v) => ({ update_units_by_pk: { id: (await updateUnit(c, str(v.id), v.set as Item)).id } })),
  DeleteUnit: mutation(WRITERS, async (c, v) => {
    await deleteUnit(c, str(v.id));
    return { delete_units_by_pk: { id: str(v.id) } };
  }),
  SetUnitVisibility: mutation(WRITERS, async (c, v) => ({ update_units_by_pk: { id: (await updateUnit(c, str(v.id), { show_on_website: Boolean(v.show) })).id } })),
  SaveShares: mutation(WRITERS, async (c, v) => {
    const updates = (v.updates as { where: { id: { _eq: string } }; _set: { common_share: number | null } }[]).map((u) => {
      if (!u.where?.id?._eq || !u._set || Object.keys(u._set).some((k) => k !== 'common_share')) fail('units_column_not_writable');
      return { id: u.where.id._eq, common_share: u._set.common_share };
    });
    await saveShares(c, updates);
    return { update_units_many: updates.map(() => ({ affected_rows: 1 })) };
  }),
  AddArea: mutation(WRITERS, async (c, v) => ({ insert_common_areas_one: { id: (await createCommonArea(c, v.object as Item)).id } })),
  UpdateArea: mutation(WRITERS, async (c, v) => ({ update_common_areas_by_pk: { id: (await updateCommonArea(c, str(v.id), v.set as Item)).id } })),
  DeleteArea: mutation(WRITERS, async (c, v) => {
    await deleteCommonArea(c, str(v.id));
    return { delete_common_areas_by_pk: { id: str(v.id) } };
  }),
};

export { matches };
