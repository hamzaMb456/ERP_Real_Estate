// The lease_overview / current_lease_rents views as pure functions: list, fiche, dashboard and the
// daily notifications all read the same flags.
import { addDays, daysBetween } from './dates.ts';
import type { Lease, LeaseRent } from './lease-rules.ts';
import { LEASE_RULES } from './lease-rules.ts';

export type RegistrationState = 'not_applicable' | 'registered' | 'overdue' | 'due_soon' | 'pending';

export interface LeaseFlags {
  is_ending_soon: boolean;
  in_grace: boolean;
  grace_days_left: number | null;
  registration_deadline: string | null;
  registration_state: RegistrationState;
}

export interface CurrentRent {
  unit_id: string;
  effective_from: string;
  rent_amount: number;
  charges_amount: number;
  next_change_on: string | null;
  next_rent_amount: number | null;
  next_charges_amount: number | null;
}

/** Money sums stay on 3 decimals (numeric(12,3)). */
const money = (n: number): number => Math.round(n * 1000) / 1000;

function registrationState(lease: Lease, deadline: string | null, today: string): RegistrationState {
  if (lease.status === 'draft' || !lease.signed_at || !deadline) return 'not_applicable';
  if (lease.registered_at) return 'registered';
  if (lease.status === 'ended' || lease.status === 'expired') return 'not_applicable';
  if (today > deadline) return 'overdue';
  if (today >= addDays(deadline, -LEASE_RULES.registration_warning_days)) return 'due_soon';
  return 'pending';
}

export function leaseFlags(lease: Lease, today: string): LeaseFlags {
  const active = lease.status === 'active';
  const graceEnd = addDays(lease.end_date, LEASE_RULES.grace_days);
  const pastEnd = active && lease.end_date < today;
  const deadline = lease.signed_at ? addDays(lease.signed_at, LEASE_RULES.registration_days) : null;
  return {
    is_ending_soon: active && lease.end_date >= today && lease.end_date <= addDays(today, LEASE_RULES.ending_soon_days),
    in_grace: pastEnd && graceEnd >= today,
    grace_days_left: pastEnd ? Math.max(daysBetween(today, graceEnd), 0) : null,
    registration_deadline: deadline,
    registration_state: registrationState(lease, deadline, today),
  };
}

/** Per unit: the latest rent started by today (else the earliest), and the next change after it. */
export function currentRents(rents: LeaseRent[], today: string): CurrentRent[] {
  const byUnit = new Map<string, LeaseRent[]>();
  for (const r of rents) byUnit.set(r.unit_id, [...(byUnit.get(r.unit_id) ?? []), r]);
  return [...byUnit.entries()].map(([unitId, rows]) => {
    const ascending = [...rows].sort((a, b) => a.effective_from.localeCompare(b.effective_from));
    const started = ascending.filter((r) => r.effective_from <= today);
    const current = started.at(-1) ?? ascending[0];
    const after = current.effective_from > today ? current.effective_from : today;
    const next = ascending.find((r) => r.effective_from > after);
    return {
      unit_id: unitId,
      effective_from: current.effective_from,
      rent_amount: current.rent_amount,
      charges_amount: current.charges_amount,
      next_change_on: next?.effective_from ?? null,
      next_rent_amount: next?.rent_amount ?? null,
      next_charges_amount: next?.charges_amount ?? null,
    };
  });
}

/** One lease_overview row. */
export function leaseOverview(lease: Lease, today: string) {
  const rents = currentRents(lease.rents, today);
  const codes = [...(lease.unit_labels ?? [])].sort((a, b) => a.localeCompare(b));
  return {
    ...lease,
    unit_count: codes.length,
    unit_codes: codes.length ? codes.join(', ') : null,
    renter_names: lease.party_names?.length ? lease.party_names.join(', ') : null,
    total_rent: money(rents.reduce((sum, r) => sum + r.rent_amount, 0)),
    total_charges: money(rents.reduce((sum, r) => sum + r.charges_amount, 0)),
    current_rents: rents,
    ...leaseFlags(lease, today),
  };
}
