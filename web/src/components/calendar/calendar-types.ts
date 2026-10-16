import type { CalendarFilters } from '@/lib/calendar';

/** A staff member (org_admin or manager) from the staff_members view. */
export type StaffOption = { user_id: string; display_name: string; email: string; role: string };

export type BranchOption = { id: string; name: string };

export type CalendarFilterState = CalendarFilters;

export type CalendarViewName = 'dayGridMonth' | 'timeGridWeek' | 'listWeek';

export const EMPTY_FILTERS: CalendarFilterState = {
  kinds: [],
  contactId: null,
  staffId: null,
  branchId: null,
  includeCancelled: false,
};
