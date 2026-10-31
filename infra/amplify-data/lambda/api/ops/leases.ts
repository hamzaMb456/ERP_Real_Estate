// Leases (baux): list, fiche, draft form, lifecycle actions, documents.
import type { Caller } from '../../domain/auth.ts';
import { todayTunis } from '../../domain/dates.ts';
import type { Item } from '../../domain/db.ts';
import { batchGet, getItem, queryAll } from '../../domain/db.ts';
import { fail } from '../../domain/errors.ts';
import { linkFile } from '../../domain/files.ts';
import { currentRents, leaseFlags, leaseOverview } from '../../domain/lease-overview.ts';
import type { DraftInput, Lease, PartyInput, RentInput } from '../../domain/lease-rules.ts';
import { activateLease, changeRent, endLease, renewLease, saveDraftLease, updateLeaseRecord } from '../../domain/leases.ts';
import { matches, sortRows } from '../query-eval.ts';
import { active, activeLeaseByUnit, byOrg, contactsById, ownerIds, ownersOf } from '../org-data.ts';
import type { Op, Vars } from '../registry.ts';
import { ORG_USERS, WRITERS, mutation, query } from '../registry.ts';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'string' ? Number(v) : (v as number));

/** A lease of the caller's organization. */
async function ownedLease(caller: Caller, id: string): Promise<Lease | null> {
  const l = await getItem('Lease', { id });
  return l?.organization_id === caller.orgId ? (l as Lease) : null;
}

/** CreateLease / UpdateDraftLease send the lease and its child rows separately: rebuild one draft. */
function draftFrom(v: Vars, existingId?: string): DraftInput {
  const lease = (existingId ? v.set : v.lease) as Item ?? {};
  const units = (v.units as { unit_id: string }[]) ?? [];
  const parties = (v.parties as PartyInput[]) ?? [];
  const rents = ((v.rents as Item[]) ?? []).map((r): RentInput => ({
    unit_id: r.unit_id, effective_from: r.effective_from ?? lease.start_date, rent_amount: num(r.rent_amount),
    charges_amount: r.charges_amount == null ? 0 : num(r.charges_amount), reason: r.reason ?? null,
  }));
  return {
    ...(existingId ? { id: existingId } : { create_id: lease.id }),
    start_date: lease.start_date, end_date: lease.end_date,
    payment_day: lease.payment_day, deposit_amount: lease.deposit_amount == null ? undefined : num(lease.deposit_amount),
    unit_ids: units.map((u) => u.unit_id), parties: parties.map((p) => ({ contact_id: p.contact_id, role: p.role })), rents,
  };
}

export const leaseOps: Record<string, Op> = {
  Leases: query(ORG_USERS, async (c) => {
    const today = todayTunis();
    const visible = (await byOrg('Lease', c.orgId)).filter((l) => !l.archived_at);
    const rows = visible.map((l) => leaseOverview(l as Lease, today));
    return {
      lease_overview: sortRows(rows, [{ number: 'desc' }]).slice(0, 500).map((o) => ({
        id: o.id, number: o.number, status: o.status, start_date: o.start_date, end_date: o.end_date, unit_count: o.unit_count,
        unit_codes: o.unit_codes, renter_names: o.renter_names, total_rent: o.total_rent, total_charges: o.total_charges,
        is_ending_soon: o.is_ending_soon, in_grace: o.in_grace, grace_days_left: o.grace_days_left,
        registration_state: o.registration_state, registration_deadline: o.registration_deadline,
      })),
    };
  }),

  Lease: query(ORG_USERS, async (c, v) => {
    const lease = await ownedLease(c, str(v.id));
    if (!lease) return { lease: null };
    const [units, parties] = await Promise.all([
      batchGet('Unit', lease.unit_ids ?? []),
      queryAll('LeaseParty', { key: 'lease_id', value: lease.id }),
    ]);
    const [properties, contacts] = await Promise.all([
      batchGet('Property', units.map((u) => u.property_id)),
      contactsById([...parties.map((p) => p.contact_id), ...ownerIds(units)]),
    ]);
    const propertyById = new Map(properties.map((p) => [p.id as string, p]));
    const o = leaseOverview(lease, todayTunis());
    return {
      lease: {
        ...lease,
        overview: { is_ending_soon: o.is_ending_soon, in_grace: o.in_grace, grace_days_left: o.grace_days_left, registration_deadline: o.registration_deadline, registration_state: o.registration_state, total_rent: o.total_rent, total_charges: o.total_charges },
        units: units.map((u) => {
          const p = propertyById.get(u.property_id);
          return { unit: { id: u.id, code: u.code, type: u.type, property: p ? { id: p.id, name: p.name } : null, current_owners: ownersOf(u, contacts).map((x) => ({ share_percent: x.share_percent, contact: { id: x.contact.id, full_name: x.contact.full_name } })) } };
        }),
        parties: parties.map((p) => {
          const contact = contacts.get(p.contact_id);
          return { role: p.role, contact: { id: p.contact_id, full_name: contact?.full_name ?? '', phone: contact?.phone ?? null, email: contact?.email ?? null } };
        }),
        terms: sortRows(lease.terms ?? [], { start_date: 'asc' }),
        rents: sortRows(lease.rents ?? [], [{ effective_from: 'asc' }]),
        current_rents: o.current_rents,
      },
    };
  }),

  DraftLease: query(ORG_USERS, async (c, v) => {
    const lease = await ownedLease(c, str(v.id));
    if (!lease) return { lease: null };
    const parties = await queryAll('LeaseParty', { key: 'lease_id', value: lease.id });
    return {
      lease: {
        id: lease.id, number: lease.number, status: lease.status, start_date: lease.start_date, end_date: lease.end_date,
        payment_day: lease.payment_day, deposit_amount: lease.deposit_amount,
        units: (lease.unit_ids ?? []).map((unit_id) => ({ unit_id })),
        parties: parties.map((p) => ({ contact_id: p.contact_id, role: p.role })),
        rents: (lease.rents ?? []).map((r) => ({ unit_id: r.unit_id, rent_amount: r.rent_amount, charges_amount: r.charges_amount })),
      },
    };
  }),

  LeaseCalendar: query(ORG_USERS, async (c, v) => {
    const lease = await ownedLease(c, str(v.id));
    if (!lease) return { lease: null };
    const [unit] = await batchGet('Unit', (lease.unit_ids ?? []).slice(0, 1));
    const property = unit ? await getItem('Property', { id: unit.property_id }) : undefined;
    const parties = await queryAll('LeaseParty', { key: 'lease_id', value: lease.id });
    return {
      lease: {
        id: lease.id,
        units: unit ? [{ unit: { id: unit.id, code: unit.code, property: { name: property?.name ?? '' } } }] : [],
        parties: parties.filter((p) => p.role === 'renter').map((p) => ({ contact_id: p.contact_id })),
      },
    };
  }),

  LeaseFormUnits: query(ORG_USERS, async (c, v) => {
    const keep = new Set((v.keep as string[]) ?? []);
    const [units, properties] = await Promise.all([byOrg('Unit', c.orgId), byOrg('Property', c.orgId)]);
    const propertyById = new Map(active(properties).map((p) => [p.id as string, p]));
    const rows = active(units)
      .filter((u) => propertyById.has(u.property_id) && (u.status === 'vacant' || keep.has(u.id)))
      .map((u) => ({ id: u.id, code: u.code, rent_amount: u.rent_amount, property: { id: u.property_id, name: propertyById.get(u.property_id)!.name } }));
    return { units: sortRows(rows, [{ property: { name: 'asc' } }, { code: 'asc' }]) };
  }),

  UnitLease: query(ORG_USERS, async (c, v) => {
    const unit = await getItem('Unit', { id: str(v.id) });
    if (unit?.organization_id !== c.orgId) return { unit_current_lease: [] };
    const today = todayTunis();
    const leases = (await byOrg('Lease', c.orgId)).filter((l) => l.status === 'active' && (l.unit_ids as string[] | undefined)?.includes(unit.id));
    return {
      unit_current_lease: sortRows(leases, [{ start_date: 'asc' }]).map((l) => {
        const f = leaseFlags(l as Lease, today);
        const rent = currentRents((l as Lease).rents ?? [], today).find((r) => r.unit_id === unit.id);
        return {
          lease_id: l.id, number: l.number, start_date: l.start_date, end_date: l.end_date,
          renter_names: (l.party_names as string[] | undefined)?.join(', ') ?? null, in_grace: f.in_grace, is_ending_soon: f.is_ending_soon,
          rent_amount: rent?.rent_amount ?? null, charges_amount: rent?.charges_amount ?? null,
        };
      }),
    };
  }),

  LeaseDocuments: query(ORG_USERS, async (c, v) => {
    const lease = await ownedLease(c, str(v.id));
    if (!lease) return { lease_files: [] };
    const files = await queryAll('FileLink', { index: 'byTarget', key: 'target_key', value: `lease#${lease.id}` });
    return { lease_files: sortRows(files, [{ created_at: 'desc' }]).map((f) => ({ id: f.id, storage_file_id: f.storage_file_id, title: f.title, category: f.category, created_at: f.created_at })) };
  }),

  CreateLease: mutation(WRITERS, async (c, v) => {
    const draft = draftFrom(v);
    const lease = await saveDraftLease(c, draft);
    return {
      insert_leases_one: { id: lease.id },
      insert_lease_units: { affected_rows: draft.unit_ids.length },
      insert_lease_parties: { affected_rows: draft.parties.length },
      insert_lease_rents: { affected_rows: draft.rents.length },
    };
  }),
  UpdateDraftLease: mutation(WRITERS, async (c, v) => {
    const current = await ownedLease(c, str(v.id));
    if (!current) fail('lease_not_found');
    const draft = draftFrom({ ...v, set: { start_date: current.start_date, end_date: current.end_date, payment_day: current.payment_day, deposit_amount: current.deposit_amount, ...(v.set as Item) } }, current.id);
    await saveDraftLease(c, draft);
    return {
      delete_lease_parties: { affected_rows: 0 }, delete_lease_units: { affected_rows: 0 }, update_leases_by_pk: { id: current.id },
      insert_lease_units: { affected_rows: draft.unit_ids.length }, insert_lease_parties: { affected_rows: draft.parties.length }, insert_lease_rents: { affected_rows: draft.rents.length },
    };
  }),
  ActivateLease: mutation(WRITERS, async (c, v) => {
    if (!(await ownedLease(c, str(v.id)))) fail('lease_not_found');
    const l = await activateLease(c, str(v.id), str(v.signed) || undefined);
    return { activate_lease: [{ id: l.id, status: l.status }] };
  }),
  RenewLease: mutation(WRITERS, async (c, v) => {
    if (!(await ownedLease(c, str(v.id)))) fail('lease_not_found');
    const rents = ((v.rents as Item[] | null) ?? []).map((r) => ({ unit_id: r.unit_id, rent_amount: num(r.rent_amount), charges_amount: r.charges_amount == null ? 0 : num(r.charges_amount) }));
    const l = await renewLease(c, str(v.id), str(v.end), rents, (v.note as string | null) ?? undefined);
    return { renew_lease: [{ id: l.id, end_date: l.end_date }] };
  }),
  EndLease: mutation(WRITERS, async (c, v) => {
    if (!(await ownedLease(c, str(v.id)))) fail('lease_not_found');
    const l = await endLease(c, str(v.id), str(v.on), (v.reason as string | null) ?? undefined);
    return { end_lease: [{ id: l.id, status: l.status }] };
  }),
  ChangeRent: mutation(WRITERS, async (c, v) => {
    const l = await changeRent(c, str(v.id), { unit_id: str(v.unit), effective_from: str(v.on), rent_amount: num(v.rent), charges_amount: num(v.charges), reason: (v.reason as string | null) ?? null });
    return { change_rent: [{ id: l.id }] };
  }),
  SetLeaseArchived: mutation(WRITERS, async (c, v) => ({ update_leases_by_pk: { id: (await updateLeaseRecord(c, str(v.id), { archived_at: (v.archived_at as string | null) ?? null })).id } })),
  SaveRegistration: mutation(WRITERS, async (c, v) => {
    if (!(await ownedLease(c, str(v.id)))) fail('lease_not_found');
    return {
      update_leases_by_pk: { id: (await updateLeaseRecord(c, str(v.id), { registered_at: (v.on as string | null) ?? null, registration_receipt: (v.receipt as string | null) ?? null })).id },
    };
  }),
  LinkLeaseFile: mutation(WRITERS, async (c, v) => {
    const o = v.object as Item;
    if (!(await ownedLease(c, str(o.lease_id)))) fail('lease_not_found');
    return { insert_lease_files_one: { id: (await linkFile(c, { lease_id: o.lease_id, storage_file_id: o.storage_file_id, title: o.title, category: o.category })).id } };
  }),
};

export { matches, activeLeaseByUnit };
