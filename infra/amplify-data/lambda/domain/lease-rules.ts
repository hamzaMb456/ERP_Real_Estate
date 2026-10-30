// Pure lease rules, ported from db/migrations/0003_leases.sql (no I/O here).
import { isIsoDate, rangesOverlap } from './dates.ts';
import { fail } from './errors.ts';

/** lease_rule(): day thresholds, defined once. */
export const LEASE_RULES = {
  grace_days: 7,
  ending_soon_days: 60,
  registration_days: 60,
  registration_warning_days: 10,
  expired_notice_days: 7,
  notification_retention_days: 90,
} as const;

export type LeaseStatus = 'draft' | 'active' | 'ended' | 'expired';

export interface LeaseRent {
  id: string;
  unit_id: string;
  effective_from: string;
  rent_amount: number;
  charges_amount: number;
  reason?: string | null;
  created_at: string;
}

export interface LeaseTerm {
  id: string;
  kind: 'initial' | 'renewal';
  start_date: string;
  end_date: string;
  recorded_on: string;
  note?: string | null;
  created_at: string;
}

export interface Lease {
  id: string;
  organization_id: string;
  number: number;
  status: LeaseStatus;
  start_date: string;
  end_date: string;
  payment_day: number;
  deposit_amount: number;
  signed_at?: string | null;
  registered_at?: string | null;
  registration_receipt?: string | null;
  ended_on?: string | null;
  end_reason?: string | null;
  archived_at?: string | null;
  rents: LeaseRent[];
  terms: LeaseTerm[];
  unit_ids?: string[];
  unit_labels?: string[];
  party_names?: string[];
  created_at: string;
  updated_at: string;
}

export interface RentInput {
  unit_id: string;
  effective_from: string;
  rent_amount: number;
  charges_amount?: number;
  reason?: string | null;
}

export interface PartyInput {
  contact_id: string;
  role: 'renter' | 'guarantor';
}

export interface DraftInput {
  /** An existing draft to replace. */
  id?: string;
  /** For a new lease: the id the client chose (its units, parties and rents already reference it). */
  create_id?: string;
  start_date: string;
  end_date: string;
  payment_day?: number;
  deposit_amount?: number;
  unit_ids: string[];
  parties: PartyInput[];
  rents: RentInput[];
}

export const END_REASONS = new Set(['term_reached', 'terminated_by_renter', 'terminated_by_owner', 'expired_auto', 'other']);
const PARTY_ROLES = new Set(['renter', 'guarantor']);
/** occupancy tx = lease + per unit (lock + status); draft tx = lease + links: both stay under 100 items. */
const MAX_LEASE_UNITS = 30;
const MAX_LEASE_PARTIES = 10;
const OCCUPYING: ReadonlySet<LeaseStatus> = new Set(['active', 'ended', 'expired']);

/** The day a lease stops occupying its units: the day it really ended, else its end date. */
export function occupiedUntil(lease: Pick<Lease, 'ended_on' | 'end_date'>): string {
  return lease.ended_on ?? lease.end_date;
}

/**
 * assert_no_lease_overlap: the lowest number of another non-draft lease whose occupied period
 * overlaps [start, end], both ends inclusive. Drafts reserve nothing.
 */
export function overlappingLeaseNumber(others: Lease[], selfId: string, start: string, end: string): number | null {
  const numbers = others
    .filter((l) => l.id !== selfId && OCCUPYING.has(l.status) && rangesOverlap(l.start_date, occupiedUntil(l), start, end))
    .map((l) => l.number)
    .sort((a, b) => a - b);
  return numbers[0] ?? null;
}

export function assertNoOverlap(others: Lease[], selfId: string, start: string, end: string): void {
  const number = overlappingLeaseNumber(others, selfId, start, end);
  if (number !== null) fail(`lease_overlap:${number}`);
}

export function assertRentAmounts(rent: number, charges: number | undefined): void {
  if (typeof rent !== 'number' || !Number.isFinite(rent) || rent < 0) fail('lease_rents_rent_amount_check');
  if (charges !== undefined && (typeof charges !== 'number' || !Number.isFinite(charges) || charges < 0)) {
    fail('lease_rents_charges_amount_check');
  }
}

/** unique (lease_id, unit_id, effective_from). */
export function assertUniqueRents(rents: Pick<LeaseRent, 'unit_id' | 'effective_from'>[]): void {
  const seen = new Set<string>();
  for (const r of rents) {
    const key = `${r.unit_id}#${r.effective_from}`;
    if (seen.has(key)) fail('lease_rents_lease_id_unit_id_effective_from_key');
    seen.add(key);
  }
}

/** The table constraints and triggers that guard a draft as it is saved. */
export function validateDraft(input: DraftInput): void {
  if (!isIsoDate(input.start_date) || !isIsoDate(input.end_date)) fail('leases_dates_check');
  if (input.end_date <= input.start_date) fail('leases_dates_check');
  const paymentDay = input.payment_day ?? 1;
  if (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 28) fail('leases_payment_day_check');
  const deposit = input.deposit_amount ?? 0;
  if (typeof deposit !== 'number' || !Number.isFinite(deposit) || deposit < 0) fail('leases_deposit_amount_check');

  // One lease commits in a single DynamoDB transaction (max 100 items): keep it well under.
  if (input.unit_ids.length > MAX_LEASE_UNITS || input.parties.length > MAX_LEASE_PARTIES) fail('lease_too_many_items');
  const units = new Set(input.unit_ids);
  if (units.size !== input.unit_ids.length) fail('lease_units_pkey');
  const contacts = new Set<string>();
  for (const p of input.parties) {
    if (!PARTY_ROLES.has(p.role)) fail('lease_parties_role_check');
    if (contacts.has(p.contact_id)) fail('lease_parties_pkey');
    contacts.add(p.contact_id);
  }
  for (const r of input.rents) {
    if (!units.has(r.unit_id)) fail('lease_unit_not_found');
    if (!isIsoDate(r.effective_from)) fail('lease_rent_before_start');
    if (r.effective_from < input.start_date) fail('lease_rent_before_start');
    assertRentAmounts(r.rent_amount, r.charges_amount);
  }
  assertUniqueRents(input.rents);
}

/** Activation preconditions that only need the lease and its links (activate_lease). */
export function assertActivatable(
  lease: Lease,
  unitIds: string[],
  parties: PartyInput[],
  signedOn: string | undefined,
  today: string,
): void {
  if (lease.status !== 'draft' || lease.archived_at) fail('lease_not_draft');
  if (signedOn !== undefined && (!isIsoDate(signedOn) || signedOn > today)) fail('lease_signed_in_future');
  if (!parties.some((p) => p.role === 'renter')) fail('lease_needs_renter');
  if (unitIds.length === 0) fail('lease_needs_unit');
  if (unitIds.some((u) => !lease.rents.some((r) => r.unit_id === u))) fail('lease_needs_rent');
  if (lease.rents.some((r) => r.effective_from < lease.start_date)) fail('lease_rent_before_start');
  const signedAt = signedOn ?? today;
  if (lease.registered_at && lease.registered_at < signedAt) fail('leases_registration_check');
}

/** Documents a lease needs on file (FileLink categories) before it can be activated without approval. */
export const ACTIVATION_DOCUMENTS = ['signed_lease', 'id_document', 'registration_receipt'] as const;

/** The unit fields that feed the deposit check. */
export interface UnitDeposit {
  id: string;
  deposit_months?: number | null;
  reservation_deposit?: number | null;
}

/**
 * What is missing for activation without a manager's approval: the lease deposit, the deposit fields
 * of each unit, and the required documents. An empty list means no approval is needed.
 */
export function activationGaps(lease: Lease, units: UnitDeposit[], documents: readonly string[]): string[] {
  const gaps: string[] = [];
  if (!(lease.deposit_amount > 0)) gaps.push('deposit_amount');
  for (const unit of units) {
    if (unit.deposit_months == null) gaps.push(`unit:${unit.id}:deposit_months`);
    if (unit.reservation_deposit == null) gaps.push(`unit:${unit.id}:reservation_deposit`);
  }
  for (const doc of ACTIVATION_DOCUMENTS) {
    if (!documents.includes(doc)) gaps.push(`doc:${doc}`);
  }
  return gaps;
}

/** renew_lease: the new end must be after both the current end and today. */
export function assertRenewable(lease: Lease, newEnd: string, today: string): void {
  if (lease.status !== 'active') fail('lease_not_active');
  const floor = lease.end_date > today ? lease.end_date : today;
  if (!isIsoDate(newEnd) || newEnd <= floor) fail('lease_renewal_not_after');
}

/** end_lease: between the start and today; a lease that has not started yet may be cancelled. */
export function assertEndable(lease: Lease, endedOn: string, reason: string | undefined, today: string): string {
  if (lease.status !== 'active') fail('lease_not_active');
  if (!isIsoDate(endedOn) || endedOn < lease.start_date) fail('lease_end_before_start');
  if (endedOn > today && lease.start_date <= today) fail('lease_end_in_future');
  const finalReason = reason?.trim() ? reason.trim() : 'other';
  if (!END_REASONS.has(finalReason)) fail('leases_end_reason_check');
  return finalReason;
}

/** Fields a client may still change once a lease is not a draft (guard_lease_update). */
export const RECORD_FIELDS_AFTER_DRAFT = new Set(['payment_day', 'deposit_amount', 'registered_at', 'registration_receipt']);

/** Units a lease's status change affects: rented while any lease on the unit is active. */
export function unitTarget(leasesOnUnit: Pick<Lease, 'status'>[]): 'rented' | 'vacant' {
  return leasesOnUnit.some((l) => l.status === 'active') ? 'rented' : 'vacant';
}
