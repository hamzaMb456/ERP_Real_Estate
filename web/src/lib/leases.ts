import { getMessages } from '@/i18n/store';
import { daysBetween, todayTunis } from '@/lib/dates';
import type { EndReason, LeaseDraftInput, LeaseOverviewRow, LeaseStatus, RegistrationState } from '@/lib/lease-types';
import { formatDate } from '@/lib/ownership';

/** Reasons a user can pick when ending a lease (expired_auto is set by the daily job only). */
export const ENDABLE_REASONS: EndReason[] = ['term_reached', 'terminated_by_renter', 'terminated_by_owner', 'other'];

/** Codes stored in the database; their labels live in the dictionary (leases.documentCategories). */
export const LEASE_DOCUMENT_CATEGORY_KEYS = ['signed_lease', 'id_document', 'registration_receipt', 'other'] as const;

export type LeaseDocumentCategory = (typeof LEASE_DOCUMENT_CATEGORY_KEYS)[number];

export const formatLeaseNumber = (number: number): string => getMessages().leases.number(number);

export const leasePeriod = (row: Pick<LeaseOverviewRow, 'start_date' | 'end_date'>): string =>
  `${formatDate(row.start_date)} ${getMessages().common.arrow} ${formatDate(row.end_date)}`;

/**
 * Money typed by a person: « 980,5 », « 1 250,500 », « 1.250,500 », « 1,250.500 ».
 * The last separator is the decimal one and may appear once; the other kind is a thousands separator.
 */
export function parseMoney(input: string): number | null {
  const compact = input.replace(/[\s  ]/g, '');
  if (compact === '') return null;
  const decimalAt = Math.max(compact.lastIndexOf(','), compact.lastIndexOf('.'));
  let normalized = compact;
  if (decimalAt !== -1) {
    const decimalChar = compact[decimalAt];
    if (compact.split(decimalChar).length - 1 > 1) return null;
    normalized = compact.slice(0, decimalAt).replace(/[.,]/g, '') + '.' + compact.slice(decimalAt + 1);
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

export function validateLeaseDraft(input: LeaseDraftInput): string | null {
  const t = getMessages().leases.validation;
  if (!input.startDate) return t.startRequired;
  if (!input.endDate) return t.endRequired;
  if (input.endDate <= input.startDate) return t.endAfterStart;
  const day = Number(input.paymentDay);
  if (!Number.isInteger(day) || day < 1 || day > 28) return t.paymentDay;
  if (input.depositAmount.trim() !== '' && parseMoney(input.depositAmount) === null) {
    return t.depositInvalid;
  }
  if (input.units.length === 0) return t.unitRequired;
  for (const unit of input.units) {
    if (parseMoney(unit.rent) === null) return t.rentRequired;
    if (unit.charges.trim() !== '' && parseMoney(unit.charges) === null) {
      return t.chargesInvalid;
    }
  }
  if (input.renters.length === 0) return t.renterRequired;
  const contacts = [...input.renters, ...input.guarantors];
  if (contacts.some((contact) => !contact)) return t.contactEach;
  if (new Set(contacts).size !== contacts.length) {
    return t.duplicateParty;
  }
  return null;
}

/** Objects for the mutations: `set` updates a draft, `units`/`parties`/`rents` are inserted after it. */
export function buildLeaseObjects(leaseId: string, input: LeaseDraftInput) {
  return {
    set: {
      start_date: input.startDate,
      end_date: input.endDate,
      payment_day: Number(input.paymentDay),
      deposit_amount: parseMoney(input.depositAmount) ?? 0,
    },
    units: input.units.map((unit) => ({ lease_id: leaseId, unit_id: unit.unitId })),
    parties: [
      ...input.renters.map((contact) => ({ lease_id: leaseId, contact_id: contact as string, role: 'renter' as const })),
      ...input.guarantors.map((contact) => ({ lease_id: leaseId, contact_id: contact as string, role: 'guarantor' as const })),
    ],
    rents: input.units.map((unit) => ({
      lease_id: leaseId,
      unit_id: unit.unitId,
      effective_from: input.startDate,
      rent_amount: parseMoney(unit.rent) ?? 0,
      charges_amount: parseMoney(unit.charges) ?? 0,
    })),
  };
}

export type RentRowInput = { unitId: string; rent: string; charges: string };
export type CurrentRent = { unit_id: string; rent_amount: number | string; charges_amount: number | string };
export type RenewalRent = { unit_id: string; rent_amount: number; charges_amount: number };

/** The rents to send with a renewal: only the units whose rent or charges differ from the current ones. */
export function planRenewalRents(rows: RentRowInput[], current: CurrentRent[]): { rents: RenewalRent[] | null } | { error: string } {
  const changed: RenewalRent[] = [];
  for (const row of rows) {
    const rent = parseMoney(row.rent);
    const charges = row.charges.trim() === '' ? 0 : parseMoney(row.charges);
    if (rent === null || charges === null) return { error: getMessages().leases.validation.renewalAmounts };
    const now = current.find((item) => item.unit_id === row.unitId);
    if (!now || Number(now.rent_amount) !== rent || Number(now.charges_amount) !== charges) {
      changed.push({ unit_id: row.unitId, rent_amount: rent, charges_amount: charges });
    }
  }
  return { rents: changed.length > 0 ? changed : null };
}

/** The dates the « Terminer le bail » dialog accepts. A lease that has not started can be cancelled from its start date. */
export function endDateBounds(startDate: string, today: string): { min: string; max: string | undefined; initial: string } {
  if (startDate > today) return { min: startDate, max: undefined, initial: startDate };
  return { min: startDate, max: today, initial: today };
}

export type RegistrationInfo ={ tone: 'neutral' | 'warning' | 'danger' | 'success'; text: string };

/** The sentence of the registration card. The state and the deadline come from the database view. */
export function describeRegistration(
  row: {
    status: LeaseStatus;
    registration_state: RegistrationState;
    registration_deadline: string | null;
    registered_at: string | null;
    registration_receipt: string | null;
  },
  today: string,
): RegistrationInfo {
  const t = getMessages().leases.registration;
  const deadline = row.registration_deadline ? formatDate(row.registration_deadline) : '';
  if (row.registration_state === 'registered' && row.registered_at) {
    const receipt = row.registration_receipt ? t.receiptSuffix(row.registration_receipt) : '';
    return { tone: 'success', text: t.registeredOn(formatDate(row.registered_at)) + receipt };
  }
  if (row.status === 'draft') return { tone: 'neutral', text: t.draft };
  if (row.registration_state === 'overdue') return { tone: 'danger', text: t.overdue(deadline) };
  if (row.registration_state === 'due_soon' && row.registration_deadline) {
    const days = daysBetween(today, row.registration_deadline);
    const left = days <= 0 ? t.lastDay : days === 1 ? t.oneDay : t.daysLeft(days);
    return { tone: 'warning', text: t.dueSoon(deadline, left) };
  }
  if (row.registration_state === 'pending') return { tone: 'neutral', text: t.pending(deadline) };
  return { tone: 'neutral', text: t.notRegistered };
}

export type LeaseTab = 'all' | 'active' | 'draft' | 'renew' | 'ended';

/** The tab codes, in display order; their labels live in the dictionary (leases.tabs). */
export const LEASE_TAB_VALUES: LeaseTab[] = ['all', 'active', 'draft', 'renew', 'ended'];

/** Active, ended more than the grace week ago, and not yet expired: nothing in the database flags it, so we do. */
export function isPastGrace(row: { status?: LeaseStatus; end_date: string; in_grace: boolean }, today: string): boolean {
  return row.status === 'active' && row.end_date < today && !row.in_grace;
}

export function matchesLeaseTab(
  row: Pick<LeaseOverviewRow, 'status' | 'is_ending_soon' | 'in_grace' | 'end_date'>,
  tab: LeaseTab,
  today: string = todayTunis(),
): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'active':
      return row.status === 'active';
    case 'draft':
      return row.status === 'draft';
    case 'renew':
      return row.is_ending_soon || row.in_grace || isPastGrace(row, today);
    case 'ended':
      return row.status === 'ended' || row.status === 'expired';
  }
}

export function matchesLeaseSearch(row: Pick<LeaseOverviewRow, 'number' | 'unit_codes' | 'renter_names'>, needle: string): boolean {
  const query = needle.trim().toLowerCase();
  if (query === '') return true;
  return [`n° ${row.number}`, String(row.number), row.unit_codes ?? '', row.renter_names ?? ''].join(' ').toLowerCase().includes(query);
}

export type LeaseFlagTone = 'info' | 'warning' | 'danger';
export type LeaseFlag = { key: string; label: string; tone: LeaseFlagTone };

type FlagRow = Pick<
  LeaseOverviewRow,
  'is_ending_soon' | 'in_grace' | 'grace_days_left' | 'registration_state' | 'registration_deadline' | 'end_date'
> & { status?: LeaseStatus };

/** The badges next to a lease's status: ending soon, grace week, registration. All thresholds come from the database flags. */
export function leaseFlags(row: FlagRow, today: string): LeaseFlag[] {
  const t = getMessages().leases.flags;
  const flags: LeaseFlag[] = [];
  if (row.in_grace) {
    flags.push({ key: 'grace', label: t.grace(row.grace_days_left ?? 0), tone: 'warning' });
  } else if (isPastGrace(row, today)) {
    flags.push({ key: 'overdue', label: t.overdue, tone: 'danger' });
  } else if (row.is_ending_soon) {
    const days = daysBetween(today, row.end_date);
    const label = days <= 0 ? t.endsToday : days === 1 ? t.endsTomorrow : t.endsIn(days);
    flags.push({ key: 'ending', label, tone: 'info' });
  }
  if (row.registration_state === 'due_soon' && row.registration_deadline) {
    flags.push({ key: 'registration', label: t.registration(formatDate(row.registration_deadline)), tone: 'warning' });
  }
  if (row.registration_state === 'overdue' && row.registration_deadline) {
    flags.push({
      key: 'registration',
      label: t.registrationLate(formatDate(row.registration_deadline)),
      tone: 'danger',
    });
  }
  return flags;
}
