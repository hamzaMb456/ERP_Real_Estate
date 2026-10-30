import type { EndReason, LeaseStatus, RegistrationState } from '@/lib/lease-types';

export const LEASE_QUERY = `
  query Lease($id: uuid!) {
    lease: leases_by_pk(id: $id) {
      id number status start_date end_date payment_day deposit_amount signed_at registered_at registration_receipt
      ended_on end_reason archived_at
      overview {
        is_ending_soon in_grace grace_days_left registration_deadline registration_state total_rent total_charges
      }
      units {
        unit {
          id code type
          property { id name }
          current_owners { share_percent contact { id full_name } }
        }
      }
      parties { role contact { id full_name phone email } }
      terms(order_by: { start_date: asc }) { id kind start_date end_date note }
      rents(order_by: [{ effective_from: asc }]) { id unit_id effective_from rent_amount charges_amount reason }
      current_rents { unit_id effective_from rent_amount charges_amount next_change_on next_rent_amount }
      approval { id status missing decision_note decided_at requested_at }
    }
  }
`;

export type LeaseDetails = {
  id: string;
  number: number;
  status: LeaseStatus;
  start_date: string;
  end_date: string;
  payment_day: number;
  deposit_amount: number | string;
  signed_at: string | null;
  registered_at: string | null;
  registration_receipt: string | null;
  ended_on: string | null;
  end_reason: EndReason | null;
  archived_at: string | null;
  overview: {
    is_ending_soon: boolean;
    in_grace: boolean;
    grace_days_left: number | null;
    registration_deadline: string | null;
    registration_state: RegistrationState;
    total_rent: number | string;
    total_charges: number | string;
  } | null;
  units: {
    unit: {
      id: string;
      code: string;
      type: string;
      property: { id: string; name: string };
      current_owners: { share_percent: number | string; contact: { id: string; full_name: string } }[];
    };
  }[];
  parties: { role: 'renter' | 'guarantor'; contact: { id: string; full_name: string; phone: string | null; email: string | null } }[];
  terms: { id: string; kind: 'initial' | 'renewal'; start_date: string; end_date: string; note: string | null }[];
  rents: { id: string; unit_id: string; effective_from: string; rent_amount: number | string; charges_amount: number | string; reason: string | null }[];
  current_rents: {
    unit_id: string;
    effective_from: string;
    rent_amount: number | string;
    charges_amount: number | string;
    next_change_on: string | null;
    next_rent_amount: number | string | null;
  }[];
  /** The latest activation request for this lease, whatever its outcome. */
  approval: {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    missing: string[];
    decision_note: string | null;
    decided_at: string | null;
    requested_at: string;
  } | null;
};
