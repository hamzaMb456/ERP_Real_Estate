import type { AppointmentKind, AppointmentStatus, EmailStatus, ParticipantRole } from '@/lib/appointment-types';
import type { AppointmentInitial } from './appointment-schema';

export const APPOINTMENT_QUERY = `
  query Appointment($id: uuid!) {
    appointment: appointments_by_pk(id: $id) {
      id kind title location starts_at ends_at status assigned_user_id unit_id lease_id notify_by_email notes
      assigned_user { display_name }
      unit { id code property { id name } }
      lease { id number }
      participants(order_by: [{ created_at: asc }]) {
        contact_id role email_status
        contact { id full_name email }
      }
    }
  }
`;

export type AppointmentDetails = {
  id: string;
  kind: AppointmentKind;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  assigned_user_id: string | null;
  unit_id: string | null;
  lease_id: string | null;
  notify_by_email: boolean;
  notes: string | null;
  assigned_user: { display_name: string } | null;
  unit: { id: string; code: string; property: { id: string; name: string } } | null;
  lease: { id: string; number: number } | null;
  participants: {
    contact_id: string;
    role: ParticipantRole;
    email_status: EmailStatus;
    contact: { id: string; full_name: string; email: string | null };
  }[];
};

/** The dialog's starting point when editing a loaded appointment. */
export function detailsToInitial(details: AppointmentDetails): AppointmentInitial {
  return {
    kind: details.kind,
    title: details.title,
    startsAt: details.starts_at,
    endsAt: details.ends_at,
    location: details.location ?? undefined,
    assignedUserId: details.assigned_user_id ?? undefined,
    unitId: details.unit_id ?? undefined,
    leaseId: details.lease_id ?? undefined,
    notifyByEmail: details.notify_by_email,
    notes: details.notes ?? undefined,
    participants: details.participants.map((participant) => ({ contactId: participant.contact_id, role: participant.role })),
  };
}
