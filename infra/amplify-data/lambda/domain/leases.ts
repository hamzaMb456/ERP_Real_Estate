// Lease operations on DynamoDB, ported from db/migrations/0003_leases.sql.
//
// Concurrency: every operation reads, checks the rules, then commits one transaction whose
// conditions prove nothing it read has changed (lease `updated_at`, a per-unit lock version for
// anything that changes which leases occupy a unit). A lost race surfaces as `concurrent_update`.
import { randomUUID } from 'node:crypto';
import type { Caller } from './auth.ts';
import { requireWriter } from './auth.ts';
import { ensureContactRole } from './contacts.ts';
import { addDays, todayTunis } from './dates.ts';
import { fail } from './errors.ts';
import type { Item, TxItem } from './db.ts';
import { batchGet, getItem, pick, queryAll, scanAll, table, transact, versionBump } from './db.ts';
import { syncPublicListing } from './public-listings.ts';
import type { DraftInput, Lease, LeaseRent, LeaseTerm, PartyInput, RentInput } from './lease-rules.ts';
import {
  LEASE_RULES,
  RECORD_FIELDS_AFTER_DRAFT,
  assertActivatable,
  assertEndable,
  assertNoOverlap,
  assertRenewable,
  assertRentAmounts,
  assertUniqueRents,
  unitTarget,
  validateDraft,
} from './lease-rules.ts';

const FORBIDDEN = 'lease_forbidden';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CREATE_ATTEMPTS = 3;

const nowIso = (): string => new Date().toISOString();
const unitLockId = (unitId: string): string => `UNITLEASE#${unitId}`;
const counterId = (orgId: string): string => `COUNTER#lease#${orgId}`;

// ------------------------------------------------------------------ reads

async function loadLease(orgId: string, id: string): Promise<Lease> {
  const lease = await getItem('Lease', { id });
  if (!lease || lease.organization_id !== orgId) fail('lease_not_found');
  return lease as Lease;
}

const leaseUnitIds = async (leaseId: string): Promise<string[]> =>
  (await queryAll('LeaseUnit', { key: 'lease_id', value: leaseId })).map((l) => l.unit_id as string);

const leaseParties = async (leaseId: string): Promise<PartyInput[]> =>
  (await queryAll('LeaseParty', { key: 'lease_id', value: leaseId })).map((p) => ({ contact_id: p.contact_id, role: p.role }));

interface UnitContext {
  units: Map<string, Item>;
  lockVersions: Map<string, number | undefined>;
  /** Non-draft leases that ever held the unit: kept on the unit's lock item, read consistently. */
  occupantIds: Map<string, string[]>;
  leasesByUnit: Map<string, Lease[]>;
}

/**
 * Each unit, its lock version and every non-draft lease that has held it. The lease list lives on
 * the lock item (not the eventually consistent byUnit index), so the overlap check never misses a
 * lease another transaction just committed.
 */
async function loadUnitContext(orgId: string, unitIds: string[]): Promise<UnitContext> {
  const ctx: UnitContext = { units: new Map(), lockVersions: new Map(), occupantIds: new Map(), leasesByUnit: new Map() };
  const linksByUnit = new Map<string, string[]>();
  await Promise.all(unitIds.map(async (unitId) => {
    const [unit, lock] = await Promise.all([
      getItem('Unit', { id: unitId }),
      getItem('Lock', { id: unitLockId(unitId) }),
    ]);
    if (!unit || unit.organization_id !== orgId) fail('lease_unit_not_found');
    ctx.units.set(unitId, unit);
    ctx.lockVersions.set(unitId, lock?.value as number | undefined);
    const occupants = (lock?.lease_ids as string[] | undefined) ?? [];
    ctx.occupantIds.set(unitId, occupants);
    linksByUnit.set(unitId, occupants);
  }));
  const leases = (await batchGet('Lease', [...linksByUnit.values()].flat())) as Lease[];
  const byId = new Map(leases.map((l) => [l.id, l]));
  for (const [unitId, ids] of linksByUnit) {
    ctx.leasesByUnit.set(unitId, ids.map((id) => byId.get(id)).filter((l): l is Lease => l !== undefined));
  }
  return ctx;
}

const otherLeases = (ctx: UnitContext): Lease[] => [...new Map(
  [...ctx.leasesByUnit.values()].flat().map((l) => [l.id, l]),
).values()];

// ------------------------------------------------------------------ transaction items

function putLease(next: Lease, previous?: Lease): TxItem {
  return {
    Put: {
      TableName: table('Lease'),
      Item: { __typename: 'Lease', ...next },
      ...(previous
        ? { ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': previous.updated_at } }
        : { ConditionExpression: 'attribute_not_exists(id)' }),
    },
  };
}

/**
 * sync_unit_status: rented while a lease on the unit is active, else vacant. Units for sale,
 * sold or under maintenance are never touched.
 */
function unitStatusItems(ctx: UnitContext, changed: Lease, now: string): TxItem[] {
  const items: TxItem[] = [];
  for (const [unitId, unit] of ctx.units) {
    if (unit.status !== 'rented' && unit.status !== 'vacant') continue;
    const leases = (ctx.leasesByUnit.get(unitId) ?? []).filter((l) => l.id !== changed.id).concat(changed);
    const target = unitTarget(leases);
    if (target === unit.status) continue;
    items.push({
      Update: {
        TableName: table('Unit'),
        Key: { id: unitId },
        UpdateExpression: 'SET #s = :target, updated_at = :now',
        ConditionExpression: '#s = :current',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':target': target, ':current': unit.status, ':now': now },
      },
    });
  }
  return items;
}

/** A change to which leases occupy the units: lease + unit locks + unit statuses, atomically. */
async function commitOccupancyChange(ctx: UnitContext, next: Lease, previous: Lease): Promise<Lease> {
  const items = [
    putLease(next, previous),
    ...[...ctx.lockVersions].map(([unitId, seen]) => versionBump(unitLockId(unitId), seen, undefined, {
      lease_ids: [...new Set([...(ctx.occupantIds.get(unitId) ?? []), next.id])],
    })),
    ...unitStatusItems(ctx, next, next.updated_at),
  ];
  await transact(items);
  // A unit that becomes rented leaves the website, one that becomes vacant may come back.
  await Promise.all([...ctx.units.keys()].map((unitId) => syncPublicListing(unitId).catch((err: Error) => {
    console.error(`public listing sync failed for unit ${unitId}:`, err.message);
  })));
  return next;
}

function newTerm(kind: LeaseTerm['kind'], start: string, end: string, today: string, now: string, note?: string): LeaseTerm {
  return { id: randomUUID(), kind, start_date: start, end_date: end, recorded_on: today, note: note?.trim() || null, created_at: now };
}

function newRent(r: RentInput, now: string, reason?: string | null): LeaseRent {
  return {
    id: randomUUID(),
    unit_id: r.unit_id,
    effective_from: r.effective_from,
    rent_amount: r.rent_amount,
    charges_amount: r.charges_amount ?? 0,
    reason: (reason ?? r.reason)?.trim() || null,
    created_at: now,
  };
}

// ------------------------------------------------------------------ drafts

function linkDiff<T>(current: T[], wanted: T[], key: (x: T) => string): { removed: T[]; added: T[] } {
  const currentKeys = new Set(current.map(key));
  const wantedKeys = new Set(wanted.map(key));
  return {
    removed: current.filter((x) => !wantedKeys.has(key(x))),
    added: wanted.filter((x) => !currentKeys.has(key(x))),
  };
}

/**
 * Create or replace a draft with its units, parties and first rents in one transaction.
 * New leases take the next per-organization number (assign_lease_number).
 */
export async function saveDraftLease(caller: Caller, input: DraftInput): Promise<Lease> {
  const orgId = requireWriter(caller, FORBIDDEN);
  validateDraft(input);

  const [units, contacts] = await Promise.all([
    batchGet('Unit', input.unit_ids),
    batchGet('Contact', input.parties.map((p) => p.contact_id)),
  ]);
  if (units.length !== input.unit_ids.length || units.some((u) => u.organization_id !== orgId)) fail('lease_unit_not_found');
  if (contacts.length !== input.parties.length || contacts.some((c) => c.organization_id !== orgId)) fail('lease_contact_not_found');

  const codeOf = new Map(units.map((u) => [u.id as string, u.code as string]));
  const nameOf = new Map(contacts.map((c) => [c.id as string, c.full_name as string]));
  // party_names = the renter names (lease_overview.renter_names), sorted.
  const partyNames = input.parties
    .filter((p) => p.role === 'renter')
    .map((p) => nameOf.get(p.contact_id) ?? '')
    .sort((a, b) => a.localeCompare(b));

  for (let attempt = 1; ; attempt += 1) {
    try {
      const lease = await commitDraft(orgId, input, {
        unitLabels: input.unit_ids.map((id) => codeOf.get(id) ?? ''),
        partyNames,
      });
      await ensureContactRole(input.parties.filter((p) => p.role === 'renter').map((p) => p.contact_id), 'renter');
      return lease;
    } catch (err) {
      // Only a new lease retries: its counter read may have lost a race with another create.
      if (input.id || attempt >= CREATE_ATTEMPTS || (err as { code?: string }).code !== 'concurrent_update') throw err;
    }
  }
}

async function commitDraft(
  orgId: string,
  input: DraftInput,
  labels: { unitLabels: string[]; partyNames: string[] },
): Promise<Lease> {
  const now = nowIso();
  const existing = input.id ? await loadLease(orgId, input.id) : undefined;
  if (existing && (existing.status !== 'draft' || existing.archived_at)) fail('lease_not_draft');

  const items: TxItem[] = [];
  let number: number;
  if (existing) {
    number = existing.number;
  } else {
    const counter = await getItem('Lock', { id: counterId(orgId) });
    const seen = counter?.value as number | undefined;
    number = (seen ?? 0) + 1;
    items.push(versionBump(counterId(orgId), seen, number));
  }

  if (!existing && input.create_id !== undefined && !UUID.test(input.create_id)) fail('lease_invalid_id');
  const leaseId = existing?.id ?? input.create_id ?? randomUUID();
  const keepRent = new Map((existing?.rents ?? []).map((r) => [`${r.unit_id}#${r.effective_from}`, r]));
  const lease: Lease = {
    id: leaseId,
    organization_id: orgId,
    number,
    status: 'draft',
    start_date: input.start_date,
    end_date: input.end_date,
    payment_day: input.payment_day ?? 1,
    deposit_amount: input.deposit_amount ?? 0,
    signed_at: null,
    registered_at: existing?.registered_at ?? null,
    registration_receipt: existing?.registration_receipt ?? null,
    ended_on: null,
    end_reason: null,
    archived_at: null,
    rents: input.rents.map((r) => {
      const kept = keepRent.get(`${r.unit_id}#${r.effective_from}`);
      return kept ? { ...kept, rent_amount: r.rent_amount, charges_amount: r.charges_amount ?? 0, reason: r.reason ?? null } : newRent(r, now);
    }),
    terms: [],
    unit_ids: input.unit_ids,
    unit_labels: labels.unitLabels,
    party_names: labels.partyNames,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  items.push(putLease(lease, existing));

  const [currentUnits, currentParties] = existing
    ? await Promise.all([leaseUnitIds(leaseId), leaseParties(leaseId)])
    : [[], []];
  const units = linkDiff(currentUnits, input.unit_ids, (u) => u);
  const parties = linkDiff(currentParties, input.parties, (p) => `${p.contact_id}#${p.role}`);
  for (const unitId of units.removed) {
    items.push({ Delete: { TableName: table('LeaseUnit'), Key: { lease_id: leaseId, unit_id: unitId } } });
  }
  for (const unitId of units.added) {
    items.push({ Put: { TableName: table('LeaseUnit'), Item: { __typename: 'LeaseUnit', lease_id: leaseId, unit_id: unitId, organization_id: orgId, created_at: now, updated_at: now } } });
  }
  const readdedContacts = new Set(parties.added.map((p) => p.contact_id));
  for (const p of parties.removed.filter((r) => !readdedContacts.has(r.contact_id))) {
    items.push({ Delete: { TableName: table('LeaseParty'), Key: { lease_id: leaseId, contact_id: p.contact_id } } });
  }
  for (const p of parties.added) {
    items.push({ Put: { TableName: table('LeaseParty'), Item: { __typename: 'LeaseParty', lease_id: leaseId, contact_id: p.contact_id, role: p.role, organization_id: orgId, created_at: now, updated_at: now } } });
  }

  await transact(items);
  return lease;
}

/**
 * guard_lease_update for direct edits: a draft may be archived or have its payment/deposit/
 * registration changed; past the draft stage only payment day, deposit and registration may change.
 */
export async function updateLeaseRecord(
  caller: Caller,
  id: string,
  patch: Partial<Pick<Lease, 'payment_day' | 'deposit_amount' | 'registered_at' | 'registration_receipt' | 'archived_at'>>,
): Promise<Lease> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const lease = await loadLease(orgId, id);
  const safe = pick(patch, [...RECORD_FIELDS_AFTER_DRAFT, 'archived_at']);
  if (lease.status !== 'draft' && Object.keys(safe).some((f) => !RECORD_FIELDS_AFTER_DRAFT.has(f))) fail('lease_not_draft');
  const next: Lease = { ...lease, ...safe, updated_at: nowIso() };
  validateDraft({ start_date: next.start_date, end_date: next.end_date, payment_day: next.payment_day, deposit_amount: next.deposit_amount, unit_ids: [], parties: [], rents: [] });
  if (next.registered_at && next.signed_at && next.registered_at < next.signed_at) fail('leases_registration_check');
  await transact([putLease(next, lease)]);
  return next;
}

/**
 * A guarantor can still join a running lease (drafts change their parties through saveDraftLease);
 * nobody can leave a lease that is not a draft.
 */
export async function addLeaseGuarantor(caller: Caller, leaseId: string, contactId: string): Promise<void> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const [lease, contact] = await Promise.all([loadLease(orgId, leaseId), getItem('Contact', { id: contactId })]);
  if (!contact || contact.organization_id !== orgId) fail('lease_contact_not_found');
  const party: PartyInput = { contact_id: contactId, role: 'guarantor' };
  const now = nowIso();
  await transact([
    { Put: { TableName: table('LeaseParty'), Item: { __typename: 'LeaseParty', lease_id: leaseId, contact_id: party.contact_id, role: party.role, organization_id: orgId, created_at: now, updated_at: now }, ConditionExpression: 'attribute_not_exists(lease_id)' } },
    { ConditionCheck: { TableName: table('Lease'), Key: { id: leaseId }, ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': lease.updated_at } } },
  ], 'lease_parties_pkey');
}

// ------------------------------------------------------------------ lifecycle

/** draft -> active: needs a renter, a unit and a first rent per unit; no overlap. */
export async function activateLease(caller: Caller, id: string, signedOn?: string, today = todayTunis()): Promise<Lease> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const lease = await loadLease(orgId, id);
  const [unitIds, parties] = await Promise.all([leaseUnitIds(id), leaseParties(id)]);
  assertActivatable(lease, unitIds, parties, signedOn, today);
  const ctx = await loadUnitContext(orgId, unitIds);
  assertNoOverlap(otherLeases(ctx), lease.id, lease.start_date, lease.end_date);
  const now = nowIso();
  return commitOccupancyChange(ctx, {
    ...lease,
    status: 'active',
    signed_at: signedOn ?? today,
    terms: [...lease.terms, newTerm('initial', lease.start_date, lease.end_date, today, now)],
    updated_at: now,
  }, lease);
}

/** Renewal moves the end date, logs a term and may add rents from the day after the old end. */
export async function renewLease(
  caller: Caller,
  id: string,
  newEnd: string,
  rents: Omit<RentInput, 'effective_from'>[] = [],
  note?: string,
  today = todayTunis(),
): Promise<Lease> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const lease = await loadLease(orgId, id);
  assertRenewable(lease, newEnd, today);
  const unitIds = await leaseUnitIds(id);
  const ctx = await loadUnitContext(orgId, unitIds);
  assertNoOverlap(otherLeases(ctx), lease.id, lease.start_date, newEnd);

  const from = addDays(lease.end_date, 1);
  const now = nowIso();
  const added = rents.map((r) => {
    if (!unitIds.includes(r.unit_id)) fail('lease_unit_not_found');
    assertRentAmounts(r.rent_amount, r.charges_amount);
    return newRent({ ...r, effective_from: from }, now, 'renewal');
  });
  assertUniqueRents([...lease.rents, ...added]);
  return commitOccupancyChange(ctx, {
    ...lease,
    end_date: newEnd,
    rents: [...lease.rents, ...added],
    terms: [...lease.terms, newTerm('renewal', from, newEnd, today, now, note)],
    updated_at: now,
  }, lease);
}

/** active -> ended, on a day between the start and today. */
export async function endLease(caller: Caller, id: string, endedOn: string, reason?: string, today = todayTunis()): Promise<Lease> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const lease = await loadLease(orgId, id);
  const finalReason = assertEndable(lease, endedOn, reason, today);
  const ctx = await loadUnitContext(orgId, await leaseUnitIds(id));
  // Leaving after the end date (grace week) must not run into a lease that follows this one.
  assertNoOverlap(otherLeases(ctx), lease.id, lease.start_date, endedOn);
  return commitOccupancyChange(ctx, {
    ...lease,
    status: 'ended',
    ended_on: endedOn,
    end_reason: finalReason,
    updated_at: nowIso(),
  }, lease);
}

/** A rent change on an active lease: a new rent row for one of its units. */
export async function changeRent(caller: Caller, id: string, rent: RentInput): Promise<Lease> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const lease = await loadLease(orgId, id);
  if (lease.status !== 'active') fail('lease_not_active');
  if (!(await leaseUnitIds(id)).includes(rent.unit_id)) fail('lease_unit_not_found');
  if (rent.effective_from < lease.start_date) fail('lease_rent_before_start');
  assertRentAmounts(rent.rent_amount, rent.charges_amount);
  const now = nowIso();
  const rents = [...lease.rents, newRent(rent, now)];
  assertUniqueRents(rents);
  const next = { ...lease, rents, updated_at: now };
  await transact([putLease(next, lease)]);
  return next;
}

/**
 * Daily job: an active lease whose grace week is over expires and frees its units.
 * One lease failing (e.g. a concurrent edit) does not stop the others.
 */
export async function expireOverdueLeases(today = todayTunis()): Promise<{ expired: Lease[]; failed: string[] }> {
  const cutoff = addDays(today, -LEASE_RULES.grace_days);
  const overdue = (await scanAll('Lease', {
    expression: '#s = :active AND end_date < :cutoff',
    names: { '#s': 'status' },
    values: { ':active': 'active', ':cutoff': cutoff },
  })) as Lease[];

  const expired: Lease[] = [];
  const failed: string[] = [];
  for (const lease of overdue) {
    try {
      const ctx = await loadUnitContext(lease.organization_id, await leaseUnitIds(lease.id));
      expired.push(await commitOccupancyChange(ctx, {
        ...lease,
        status: 'expired',
        ended_on: lease.end_date,
        end_reason: 'expired_auto',
        updated_at: nowIso(),
      }, lease));
    } catch (err) {
      console.error(`expireOverdueLeases: lease ${lease.id} failed:`, (err as Error).message);
      failed.push(lease.id);
    }
  }
  return { expired, failed };
}
