// Contacts and ownerships.
import type { Caller } from '../../domain/auth.ts';
import { createContact, updateContact } from '../../domain/contacts.ts';
import { todayTunis } from '../../domain/dates.ts';
import type { Item } from '../../domain/db.ts';
import { batchGet, getItem, queryAll } from '../../domain/db.ts';
import { fail } from '../../domain/errors.ts';
import { leaseFlags } from '../../domain/lease-overview.ts';
import type { Lease } from '../../domain/lease-rules.ts';
import type { Ownership } from '../../domain/ownership-rules.ts';
import type { OwnershipInput } from '../../domain/ownerships.ts';
import { changeOwnerships } from '../../domain/ownerships.ts';
import type { Where } from '../query-eval.ts';
import { matches, page, sortRows } from '../query-eval.ts';
import { byOrg, contactsById, count, groupBy } from '../org-data.ts';
import type { Op } from '../registry.ts';
import { ORG_USERS, WRITERS, mutation, query } from '../registry.ts';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const rolesOf = (c: Item) => ((c.roles as string[] | undefined) ?? []).map((role) => ({ role }));

/** A contact of the caller's organization, or null when it is missing or foreign. */
async function ownedContact(caller: Caller, id: string): Promise<Item | null> {
  const c = await getItem('Contact', { id });
  return c?.organization_id === caller.orgId ? c : null;
}

/** Writes on a contact of another organization, or a missing one, are refused as not found. */
async function writableContact(caller: Caller, id: string): Promise<Item> {
  const contact = await ownedContact(caller, id);
  if (!contact) fail('contact_not_found');
  return contact;
}

/** current_ownerships_aggregate per contact: how many units list the contact as a current owner. */
async function ownedUnitCounts(orgId: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const u of await byOrg('Unit', orgId)) {
    for (const o of (u.current_owners as { contact_id: string }[] | undefined) ?? []) counts.set(o.contact_id, (counts.get(o.contact_id) ?? 0) + 1);
  }
  return counts;
}

const toInput = (o: Item): OwnershipInput => ({
  id: o.id, contact_id: o.contact_id, share_percent: Number(o.share_percent), starts_on: o.starts_on, ends_on: o.ends_on ?? null, notes: o.notes ?? null,
});

/** Every row of one change must be on the same unit (one atomic change under that unit's lock). */
function singleUnit(unitIds: string[]): string {
  const unique = [...new Set(unitIds)];
  if (unique.length !== 1) fail('ownership_single_unit_required');
  return unique[0];
}

async function ownedOwnerships(caller: Caller, ids: string[]): Promise<Ownership[]> {
  const rows = (await batchGet('Ownership', ids)) as Ownership[];
  if (rows.length !== new Set(ids).size || rows.some((r) => r.organization_id !== caller.orgId)) fail('ownership_not_found');
  return rows;
}

export const peopleOps: Record<string, Op> = {
  Contacts: query(ORG_USERS, async (c) => {
    const [contacts, counts] = await Promise.all([byOrg('Contact', c.orgId), ownedUnitCounts(c.orgId)]);
    return {
      contacts: sortRows(contacts, { full_name: 'asc' }).slice(0, 500).map((x) => ({
        id: x.id, kind: x.kind, full_name: x.full_name, email: x.email, phone: x.phone, archived_at: x.archived_at,
        is_organization: x.is_organization, roles: rolesOf(x), current_ownerships_aggregate: count(counts.get(x.id) ?? 0),
      })),
    };
  }),
  Contact: query(ORG_USERS, async (c, v) => {
    const x = await ownedContact(c, str(v.id));
    return { contact: x ? { ...x, roles: rolesOf(x) } : null };
  }),
  ContactForEdit: query(ORG_USERS, async (c, v) => {
    const x = await ownedContact(c, str(v.id));
    if (!x) return { contact: null };
    const counts = await ownedUnitCounts(c.orgId);
    return { contact: { ...x, roles: rolesOf(x), current_ownerships_aggregate: count(counts.get(x.id) ?? 0) } };
  }),
  ContactOptions: query(ORG_USERS, async (c) => {
    const contacts = (await byOrg('Contact', c.orgId)).filter((x) => !x.archived_at);
    return {
      contacts: sortRows(contacts, [{ is_organization: 'desc' }, { full_name: 'asc' }])
        .map((x) => ({ id: x.id, full_name: x.full_name, kind: x.kind, is_organization: x.is_organization })),
    };
  }),
  ContactDuplicates: query(ORG_USERS, async (c, v) => {
    const contacts = await byOrg('Contact', c.orgId);
    return {
      contacts: page(contacts.filter((x) => matches(x, v.where as Where)), 10)
        .map((x) => ({ id: x.id, full_name: x.full_name, national_id: x.national_id, email: x.email, phone: x.phone })),
    };
  }),
  ContactLeases: query(ORG_USERS, async (c, v) => {
    const contact = await ownedContact(c, str(v.id));
    if (!contact) return { lease_parties: [] };
    const parties = (await queryAll('LeaseParty', { index: 'byContact', key: 'contact_id', value: contact.id })).filter((p) => p.role === v.role);
    const leases = (await batchGet('Lease', parties.map((p) => p.lease_id))) as Lease[];
    const units = await batchGet('Unit', leases.flatMap((l) => l.unit_ids ?? []));
    const properties = new Map((await batchGet('Property', units.map((u) => u.property_id))).map((p) => [p.id as string, p]));
    const unitById = new Map(units.map((u) => [u.id as string, u]));
    const today = todayTunis();
    return {
      lease_parties: sortRows(leases, { number: 'desc' }).map((l) => {
        const f = leaseFlags(l, today);
        return {
          lease: {
            id: l.id, number: l.number, status: l.status, start_date: l.start_date, end_date: l.end_date,
            overview: { is_ending_soon: f.is_ending_soon, in_grace: f.in_grace, grace_days_left: f.grace_days_left, registration_state: f.registration_state, registration_deadline: f.registration_deadline },
            units: (l.unit_ids ?? []).map((id) => unitById.get(id)).filter(Boolean)
              .map((u) => ({ unit: { code: u!.code, property: { name: properties.get(u!.property_id)?.name ?? '' } } })),
          },
        };
      }),
    };
  }),

  AddContact: mutation(WRITERS, async (c, v) => {
    const { roles, ...object } = (v.object ?? {}) as Item;
    const nested = (roles as { data?: { role: string }[] } | undefined)?.data?.map((r) => r.role) ?? [];
    return { insert_contacts_one: { id: (await createContact(c, object, nested)).id } };
  }),
  AddContactRoles: mutation(WRITERS, async (c, v) => {
    const objects = (v.objects as { contact_id: string; role: string }[]) ?? [];
    const byContact = groupBy(objects as Item[], 'contact_id');
    for (const [contactId, rows] of byContact) {
      await writableContact(c, contactId);
      await updateContact(c, contactId, {}, [], rows.map((r) => r.role));
    }
    return { insert_contact_roles: { affected_rows: objects.length } };
  }),
  UpdateContact: mutation(WRITERS, async (c, v) => {
    await writableContact(c, str(v.id));
    const added = ((v.added as { role: string }[]) ?? []).map((r) => r.role);
    await updateContact(c, str(v.id), (v.set ?? {}) as Item, (v.removed as string[]) ?? [], added);
    return {
      update_contacts_by_pk: { id: str(v.id) },
      delete_contact_roles: { affected_rows: ((v.removed as string[]) ?? []).length },
      insert_contact_roles: { affected_rows: added.length },
    };
  }),
  SetContactArchived: mutation(WRITERS, async (c, v) => {
    await writableContact(c, str(v.id));
    return { update_contacts_by_pk: { id: (await updateContact(c, str(v.id), { archived_at: v.archived_at ?? null })).id } };
  }),

  UnitOwnerships: query(ORG_USERS, async (c, v) => {
    const unit = await getItem('Unit', { id: str(v.unitId) });
    if (unit?.organization_id !== c.orgId) return { ownerships: [] };
    const rows = await queryAll('Ownership', { index: 'byUnit', key: 'unit_id', value: unit.id });
    const contacts = await contactsById(rows.map((r) => r.contact_id));
    return {
      ownerships: sortRows(rows, { starts_on: 'desc' }).map((o) => {
        const contact = contacts.get(o.contact_id);
        return {
          id: o.id, unit_id: o.unit_id, contact_id: o.contact_id, share_percent: o.share_percent, starts_on: o.starts_on, ends_on: o.ends_on, notes: o.notes,
          contact: { id: o.contact_id, full_name: contact?.full_name ?? '', is_organization: contact?.is_organization ?? false },
        };
      }),
    };
  }),
  ContactOwnerships: query(ORG_USERS, async (c, v) => {
    const contact = await ownedContact(c, str(v.contactId));
    if (!contact) return { ownerships: [] };
    const rows = await queryAll('Ownership', { index: 'byContact', key: 'contact_id', value: contact.id });
    const units = new Map((await batchGet('Unit', rows.map((r) => r.unit_id))).map((u) => [u.id as string, u]));
    const properties = new Map((await batchGet('Property', [...units.values()].map((u) => u.property_id))).map((p) => [p.id as string, p]));
    return {
      ownerships: sortRows(rows, { starts_on: 'desc' }).map((o) => {
        const u = units.get(o.unit_id);
        const p = u ? properties.get(u.property_id) : undefined;
        return {
          id: o.id, share_percent: o.share_percent, starts_on: o.starts_on, ends_on: o.ends_on,
          unit: u ? { id: u.id, code: u.code, property: p ? { id: p.id, name: p.name } : null } : null,
        };
      }),
    };
  }),

  AddOwnership: mutation(WRITERS, async (c, v) => {
    const o = v.object as Item;
    const after = await changeOwnerships(c, str(o.unit_id), { upsert: [toInput({ ...o, id: undefined })] });
    const created = after.find((r) => r.contact_id === o.contact_id && r.starts_on === o.starts_on);
    return { insert_ownerships_one: { id: created?.id ?? null } };
  }),
  /** End the current owners and start the new ones as one change (a transfer passes the 100 % cap). */
  TransferOwnership: mutation(WRITERS, async (c, v) => {
    const ended = await ownedOwnerships(c, (v.endIds as string[]) ?? []);
    const objects = (v.objects as Item[]) ?? [];
    const unitId = singleUnit([...ended.map((r) => r.unit_id), ...objects.map((o) => str(o.unit_id))]);
    await changeOwnerships(c, unitId, {
      upsert: [...ended.map((r) => toInput({ ...r, ends_on: v.endOn })), ...objects.map((o) => toInput({ ...o, id: undefined }))],
    });
    return { update_ownerships: { affected_rows: ended.length }, insert_ownerships: { affected_rows: objects.length } };
  }),
  /** Delete one ownership and reopen the ones it had closed, as one change. */
  DeleteOwnership: mutation(WRITERS, async (c, v) => {
    const [target] = await ownedOwnerships(c, [str(v.id)]);
    const reopened = await ownedOwnerships(c, (v.reopen as string[]) ?? []);
    singleUnit([target.unit_id, ...reopened.map((r) => r.unit_id)]);
    await changeOwnerships(c, target.unit_id, { remove: [target.id], upsert: reopened.map((r) => toInput({ ...r, ends_on: null })) });
    return { delete_ownerships_by_pk: { id: target.id }, update_ownerships: { affected_rows: reopened.length } };
  }),
};
