'use client';

import { useGraphql } from '@/lib/use-graphql';

const QUERY = `query MyUnitRequests($unit: uuid!) { has_rental_request has_visit_request }`;

export type UnitRequestsState = { hasRentalRequest: boolean; hasVisitRequest: boolean };

const NONE: UnitRequestsState = { hasRentalRequest: false, hasVisitRequest: false };

/**
 * Whether the signed-in client already sent a rental or visit request for this unit: the booking card disables the
 * matching button(s) so they cannot resubmit. `false` while signed out, loading or on error (the server stays the
 * authority against actual resubmission; this only improves the button's state).
 */
export function useUnitRequests(unitId: string, enabled: boolean, reloadKey = 0): UnitRequestsState {
  const state = useGraphql<{ has_rental_request: boolean; has_visit_request: boolean }>(enabled ? QUERY : '', { unit: unitId }, reloadKey);
  return state.status === 'success' ? { hasRentalRequest: state.data.has_rental_request, hasVisitRequest: state.data.has_visit_request } : NONE;
}
