export type LeaseStatus = 'draft' | 'active' | 'ended' | 'expired';
export type RegistrationState = 'not_applicable' | 'registered' | 'pending' | 'due_soon' | 'overdue';
export type EndReason = 'term_reached' | 'terminated_by_renter' | 'terminated_by_owner' | 'expired_auto' | 'other';

/** One row of the lease_overview view: everything the list, the fiche header and the tiles need. */
export type LeaseOverviewRow = {
  id: string;
  number: number;
  status: LeaseStatus;
  start_date: string;
  end_date: string;
  unit_count: number;
  unit_codes: string | null;
  renter_names: string | null;
  total_rent: number | string;
  total_charges: number | string;
  is_ending_soon: boolean;
  in_grace: boolean;
  grace_days_left: number | null;
  registration_state: RegistrationState;
  registration_deadline: string | null;
};

export type LeaseUnitInput = { unitId: string; rent: string; charges: string };

/** What the lease form holds, as typed by the user (money and numbers are still text). */
export type LeaseDraftInput = {
  startDate: string;
  endDate: string;
  paymentDay: string;
  depositAmount: string;
  units: LeaseUnitInput[];
  renters: (string | null)[];
  guarantors: (string | null)[];
};
