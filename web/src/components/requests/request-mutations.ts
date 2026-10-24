import { graphql } from '@/lib/graphql';
import { visitWindow, type RentalStatus, type VisitRequest, type VisitStatus } from '@/lib/requests';

const SET_RENTAL = `
  mutation SetRentalRequest($id: uuid!, $set: rental_requests_set_input!) {
    update_rental_requests_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

const SET_VISIT = `
  mutation SetVisitRequest($id: uuid!, $set: visit_requests_set_input!) {
    update_visit_requests_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

/** Confirming a visit books it in the calendar and marks the request in ONE request: both succeed or neither does. */
const CONFIRM_VISIT = `
  mutation ConfirmVisit($appointment: appointments_insert_input!, $id: uuid!, $appointmentId: uuid!) {
    insert_appointments_one(object: $appointment) { id }
    update_visit_requests_by_pk(pk_columns: { id: $id }, _set: { status: "confirmed", appointment_id: $appointmentId }) { id }
  }
`;

const CLOSE_VISIT = `
  mutation CloseVisit($id: uuid!, $status: String!, $appointmentId: uuid!, $appointmentStatus: String!) {
    update_visit_requests_by_pk(pk_columns: { id: $id }, _set: { status: $status }) { id }
    update_appointments_by_pk(pk_columns: { id: $appointmentId }, _set: { status: $appointmentStatus }) { id }
  }
`;

const cleanNote = (note: string): string | null => (note.trim() === '' ? null : note.trim());

export const setRentalStatus = (id: string, status: RentalStatus): Promise<unknown> => graphql(SET_RENTAL, { id, set: { status } });

export const saveRentalNote = (id: string, note: string): Promise<unknown> => graphql(SET_RENTAL, { id, set: { staff_note: cleanNote(note) } });

export const saveVisitNote = (id: string, note: string): Promise<unknown> => graphql(SET_VISIT, { id, set: { staff_note: cleanNote(note) } });

/** Status change without a calendar side effect (decline, reopen). */
export const setVisitStatus = (id: string, status: VisitStatus): Promise<unknown> => graphql(SET_VISIT, { id, set: { status } });

/** Books the visit in the calendar (kind « viewing », half an hour, no e-mail) and confirms the request. */
export function confirmVisit(request: VisitRequest, title: string): Promise<unknown> {
  const appointmentId = crypto.randomUUID();
  const { startsAt, endsAt } = visitWindow(request.visit_date, request.visit_time);
  return graphql(CONFIRM_VISIT, {
    id: request.id,
    appointmentId,
    appointment: {
      id: appointmentId,
      kind: 'viewing',
      title,
      location: null,
      starts_at: startsAt,
      ends_at: endsAt,
      assigned_user_id: null,
      unit_id: request.unit.id,
      lease_id: null,
      notify_by_email: false,
      notes: request.message,
    },
  });
}

/** Marks a confirmed visit done or cancelled, and its calendar appointment with it. */
export function closeVisit(request: VisitRequest, status: 'done' | 'cancelled'): Promise<unknown> {
  if (request.appointment_id === null) return setVisitStatus(request.id, status);
  return graphql(CLOSE_VISIT, {
    id: request.id,
    status,
    appointmentId: request.appointment_id,
    appointmentStatus: status === 'done' ? 'done' : 'cancelled',
  });
}

/** True when the failure is the unique index that keeps two confirmed visits off one slot. */
export const isSlotTaken = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('visit_requests_one_confirmed_slot');
