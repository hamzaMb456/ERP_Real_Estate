// String unions matching the CHECK constraints of db/migrations/0004_calendar_notifications.sql.

export type AppointmentKind = 'viewing' | 'move_in' | 'move_out' | 'meeting' | 'other';
export type AppointmentStatus = 'planned' | 'done' | 'cancelled';
export type ParticipantRole = 'renter' | 'guarantor' | 'prospect' | 'buyer' | 'other';
export type EmailStatus = 'pending' | 'sent' | 'failed' | 'skipped';
export type NotificationKind =
  | 'lease_ending_soon'
  | 'lease_grace'
  | 'lease_expired'
  | 'registration_due'
  | 'registration_overdue'
  | 'appointment_reminder'
  | 'rental_request'
  | 'visit_request';

/** Kinds of the all-day lease rows of calendar_feed. */
export type LeaseEventKind = 'lease_start' | 'lease_end' | 'registration_deadline';

/** One row of the calendar_feed view, as GraphQL returns it (column names kept in snake_case). */
export interface FeedRow {
  event_id: string;
  organization_id: string;
  source: 'appointment' | 'lease';
  kind: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  status: string;
  appointment_id: string | null;
  lease_id: string | null;
  unit_id: string | null;
  branch_id: string | null;
  assigned_user_id: string | null;
  contact_ids: string[];
  location: string | null;
  notify_by_email: boolean;
}
