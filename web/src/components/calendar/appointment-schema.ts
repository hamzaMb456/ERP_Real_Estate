import { z } from 'zod';
import { getMessages } from '@/i18n/store';
import { isoToTunisParts, tunisToIso } from '@/lib/appointments';
import type { AppointmentKind } from '@/lib/appointment-types';
import { todayTunis } from '@/lib/dates';
import type { AppointmentFields, ParticipantInput } from './appointment-mutations';

export const APPOINTMENT_KINDS = ['viewing', 'move_in', 'move_out', 'meeting', 'other'] as const;
export const PARTICIPANT_ROLES = ['renter', 'guarantor', 'prospect', 'buyer', 'other'] as const;

const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_TIME = '09:00';
const MINUTE_MS = 60_000;

/** The form's schema, with its messages in the language the interface renders in (build it when the form mounts). */
export function appointmentSchema() {
  const t = getMessages().calendar.validation;
  return z.object({
    kind: z.enum(APPOINTMENT_KINDS),
    title: z.string().trim().min(1, t.titleRequired),
    date: z.string().min(1, t.dateRequired),
    time: z.string().min(1, t.timeRequired),
    // The end is the start plus this many minutes: zero or less puts the end on or before the start.
    duration: z.string().trim().refine((value) => /^\d+$/.test(value) && Number(value) > 0, t.endAfterStart),
    location: z.string(),
    unitId: z.string(),
    assignedUserId: z.string(),
    participants: z
      .array(z.object({ contactId: z.string().nullable(), role: z.enum(PARTICIPANT_ROLES) }))
      .refine((rows) => rows.every((row) => row.contactId !== null), t.contactEach),
    notifyByEmail: z.boolean(),
    notes: z.string(),
  });
}

export type AppointmentFormValues = z.infer<ReturnType<typeof appointmentSchema>>;

/** What the dialog starts from: a slot clicked in the calendar, a lease, or an appointment being edited. */
export type AppointmentInitial = {
  startsAt?: string;
  endsAt?: string;
  leaseId?: string;
  unitId?: string;
  kind?: AppointmentKind;
  title?: string;
  location?: string;
  assignedUserId?: string;
  notifyByEmail?: boolean;
  notes?: string;
  participants?: ParticipantInput[];
};

export function buildDefaults(initial: AppointmentInitial | undefined): AppointmentFormValues {
  const start = initial?.startsAt ? isoToTunisParts(initial.startsAt) : { date: todayTunis(), time: DEFAULT_TIME };
  const minutes =
    initial?.startsAt && initial.endsAt
      ? Math.round((Date.parse(initial.endsAt) - Date.parse(initial.startsAt)) / MINUTE_MS)
      : DEFAULT_DURATION_MINUTES;
  return {
    kind: initial?.kind ?? 'viewing',
    title: initial?.title ?? '',
    date: start.date,
    time: start.time,
    duration: String(minutes),
    location: initial?.location ?? '',
    unitId: initial?.unitId ?? '',
    assignedUserId: initial?.assignedUserId ?? '',
    participants: (initial?.participants ?? []).map((participant) => ({ ...participant })),
    notifyByEmail: initial?.notifyByEmail ?? true,
    notes: initial?.notes ?? '',
  };
}

/** The start and end instants of the form, or null while the date, time or duration is not usable. */
export function slotOf(values: Pick<AppointmentFormValues, 'date' | 'time' | 'duration'>): { startsAt: string; endsAt: string } | null {
  const minutes = Number(values.duration);
  if (!values.date || !values.time || !Number.isInteger(minutes) || minutes <= 0) return null;
  const startsAt = tunisToIso(values.date, values.time);
  const start = Date.parse(startsAt);
  if (Number.isNaN(start)) return null;
  return { startsAt, endsAt: new Date(start + minutes * MINUTE_MS).toISOString() };
}

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** The columns to write for a valid form. The lease is not editable here: it comes from `initial`. */
export function toFields(values: AppointmentFormValues, slot: { startsAt: string; endsAt: string }, leaseId: string | null): AppointmentFields {
  return {
    kind: values.kind,
    title: values.title,
    location: orNull(values.location),
    starts_at: slot.startsAt,
    ends_at: slot.endsAt,
    assigned_user_id: orNull(values.assignedUserId),
    unit_id: orNull(values.unitId),
    lease_id: leaseId,
    notify_by_email: values.notifyByEmail,
    notes: orNull(values.notes),
  };
}

export function toParticipants(values: AppointmentFormValues): ParticipantInput[] {
  return values.participants.flatMap((row) => (row.contactId ? [{ contactId: row.contactId, role: row.role }] : []));
}
