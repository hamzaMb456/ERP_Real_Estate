import { daysBetween } from '@/lib/dates';
import type { EndReason, LeaseDraftInput, LeaseOverviewRow, LeaseStatus } from '@/lib/lease-types';
import { formatDateFr } from '@/lib/ownership';

export const LEASE_STATUS_LABELS: Record<LeaseStatus, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  ended: 'Terminé',
  expired: 'Expiré',
};

export const END_REASON_LABELS: Record<EndReason, string> = {
  term_reached: 'Fin du bail à son terme',
  terminated_by_renter: 'Résiliation par le locataire',
  terminated_by_owner: 'Résiliation par le bailleur',
  expired_auto: 'Expiré automatiquement',
  other: 'Autre motif',
};

/** Reasons staff can pick when ending a lease (expired_auto is set by the daily job only). */
export const ENDABLE_REASONS: EndReason[] = ['term_reached', 'terminated_by_renter', 'terminated_by_owner', 'other'];

export const LEASE_DOCUMENT_CATEGORIES = {
  signed_lease: 'Bail signé',
  id_document: 'Pièces d’identité',
  registration_receipt: 'Reçu d’enregistrement',
  other: 'Autres',
} as const;

export type LeaseDocumentCategory = keyof typeof LEASE_DOCUMENT_CATEGORIES;

export const formatLeaseNumber = (number: number): string => `Bail N° ${number}`;

export const leasePeriod = (row: Pick<LeaseOverviewRow, 'start_date' | 'end_date'>): string =>
  `${formatDateFr(row.start_date)} → ${formatDateFr(row.end_date)}`;

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
  if (!input.startDate) return 'Indiquez la date de début.';
  if (!input.endDate) return 'Indiquez la date de fin.';
  if (input.endDate <= input.startDate) return 'La date de fin doit suivre la date de début.';
  const day = Number(input.paymentDay);
  if (!Number.isInteger(day) || day < 1 || day > 28) return 'Le jour de paiement doit être compris entre 1 et 28.';
  if (input.depositAmount.trim() !== '' && parseMoney(input.depositAmount) === null) {
    return 'Le dépôt de garantie n’est pas un montant valide.';
  }
  if (input.units.length === 0) return 'Choisissez au moins une unité.';
  for (const unit of input.units) {
    if (parseMoney(unit.rent) === null) return 'Indiquez le loyer de chaque unité.';
    if (unit.charges.trim() !== '' && parseMoney(unit.charges) === null) {
      return 'Les charges d’une unité ne sont pas un montant valide.';
    }
  }
  if (input.renters.length === 0) return 'Ajoutez au moins un locataire.';
  const contacts = [...input.renters, ...input.guarantors];
  if (contacts.some((contact) => !contact)) return 'Choisissez un contact pour chaque ligne.';
  if (new Set(contacts).size !== contacts.length) {
    return 'Un même contact ne peut apparaître qu’une fois sur le bail (locataire ou garant).';
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

export type LeaseTab = 'all' | 'active' | 'draft' | 'renew' | 'ended';

export const LEASE_TABS: { value: LeaseTab; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'active', label: 'Actifs' },
  { value: 'draft', label: 'Brouillons' },
  { value: 'renew', label: 'À renouveler' },
  { value: 'ended', label: 'Terminés' },
];

export const LEASE_TAB_VALUES = LEASE_TABS.map((item) => item.value);

export function matchesLeaseTab(row: Pick<LeaseOverviewRow, 'status' | 'is_ending_soon' | 'in_grace'>, tab: LeaseTab): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'active':
      return row.status === 'active';
    case 'draft':
      return row.status === 'draft';
    case 'renew':
      return row.is_ending_soon || row.in_grace;
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
>;

/** The badges next to a lease's status: ending soon, grace week, registration. All thresholds come from the database flags. */
export function leaseFlags(row: FlagRow, today: string): LeaseFlag[] {
  const flags: LeaseFlag[] = [];
  if (row.in_grace) {
    flags.push({ key: 'grace', label: `Échu · à renouveler (${row.grace_days_left ?? 0} j)`, tone: 'warning' });
  } else if (row.is_ending_soon) {
    const days = daysBetween(today, row.end_date);
    const label = days <= 0 ? 'Fin aujourd’hui' : days === 1 ? 'Fin demain' : `Fin dans ${days} jours`;
    flags.push({ key: 'ending', label, tone: 'info' });
  }
  if (row.registration_state === 'due_soon' && row.registration_deadline) {
    flags.push({ key: 'registration', label: `Enregistrement avant le ${formatDateFr(row.registration_deadline)}`, tone: 'warning' });
  }
  if (row.registration_state === 'overdue' && row.registration_deadline) {
    flags.push({
      key: 'registration',
      label: `Enregistrement en retard (échéance ${formatDateFr(row.registration_deadline)})`,
      tone: 'danger',
    });
  }
  return flags;
}
