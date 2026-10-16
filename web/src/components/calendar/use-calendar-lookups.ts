'use client';

import type { BranchOption, StaffOption } from './calendar-types';
import { useGraphql, type QueryState } from '@/lib/use-graphql';

const LOOKUPS_QUERY = `
  query CalendarLookups {
    staff_members(order_by: [{ display_name: asc }]) { user_id display_name email role }
    branches(order_by: [{ name: asc }]) { id name }
  }
`;

export type CalendarLookups = { staff: StaffOption[]; branches: BranchOption[] };

/** The staff who can be put in charge of an appointment, and the branches for the filter. */
export function useCalendarLookups(): QueryState<CalendarLookups> {
  const result = useGraphql<{ staff_members: StaffOption[]; branches: BranchOption[] }>(LOOKUPS_QUERY);
  return result.status === 'success'
    ? { status: 'success', data: { staff: result.data.staff_members, branches: result.data.branches } }
    : result;
}
