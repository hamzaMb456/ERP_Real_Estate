import { getMessages } from '@/i18n/store';
import type { AppointmentKind, AppointmentStatus, EmailStatus, ParticipantRole } from '@/lib/appointment-types';

// Labels live in the calendar dictionary (src/i18n/messages/*/calendar.ts); these read the current language at call time.

export const appointmentKindLabels = (): Record<AppointmentKind, string> => getMessages().calendar.kinds;

export const participantRoleLabels = (): Record<ParticipantRole, string> => getMessages().calendar.roles;

export const appointmentStatusLabels = (): Record<AppointmentStatus, string> => getMessages().calendar.statuses;

/** A kind label, or the raw code when the database holds a kind this version does not know. */
export const appointmentKindLabel = (kind: string): string => appointmentKindLabels()[kind as AppointmentKind] ?? kind;

export const emailStatusLabel = (status: EmailStatus): string => getMessages().calendar.emailStatuses[status];

/**
 * The e-mail status shown next to a participant. « skipped » has two causes, so it is spelled out:
 * the appointment has « Prévenir par e-mail » off, or the contact has no address.
 */
export function participantEmailLabel(status: EmailStatus, context: { notifyByEmail: boolean; hasEmail: boolean }): string {
  if (status !== 'skipped') return emailStatusLabel(status);
  const t = getMessages().calendar.participantEmail;
  if (!context.notifyByEmail) return t.disabled;
  return context.hasEmail ? t.noneSent : emailStatusLabel(status);
}

/** A Tunis wall-clock date (YYYY-MM-DD) and time (HH:mm) as an ISO instant. Tunisia is UTC+1 all year. */
export const tunisToIso = (date: string, time: string): string => `${date}T${time}:00+01:00`;

const tunisParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Tunis',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** The Tunis date and HH:mm of an ISO instant, whatever time zone the browser runs in. */
export function isoToTunisParts(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(tunisParts.formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

interface Slot {
  assignedUserId: string | null;
  startsAt: string;
  endsAt: string;
}

const overlaps = (a: Slot, b: Slot): boolean =>
  Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);

/**
 * Ids of the planned appointments of the same staff member that overlap the candidate.
 * Cancelled and done appointments never conflict; touching slots (end = start) do not overlap.
 */
export function findStaffConflicts(
  candidate: Slot & { id?: string },
  others: (Slot & { id: string; status: AppointmentStatus })[],
): string[] {
  if (!candidate.assignedUserId) return [];
  return others
    .filter(
      (other) =>
        other.id !== candidate.id &&
        other.status === 'planned' &&
        other.assignedUserId === candidate.assignedUserId &&
        overlaps(candidate, other),
    )
    .map((other) => other.id);
}
