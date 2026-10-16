import type { AppointmentKind, AppointmentStatus, EmailStatus, ParticipantRole } from '@/lib/appointment-types';

export const APPOINTMENT_KIND_LABELS: Record<AppointmentKind, string> = {
  viewing: 'Visite',
  move_in: 'État des lieux d’entrée',
  move_out: 'État des lieux de sortie',
  meeting: 'Rendez-vous',
  other: 'Autre',
};

export const PARTICIPANT_ROLE_LABELS: Record<ParticipantRole, string> = {
  renter: 'Locataire',
  guarantor: 'Garant',
  prospect: 'Prospect',
  buyer: 'Acheteur',
  other: 'Autre',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  planned: 'Prévu',
  done: 'Fait',
  cancelled: 'Annulé',
};

const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  sent: 'E-mail envoyé',
  failed: 'E-mail non envoyé · Renvoyer',
  skipped: 'Pas d’adresse e-mail',
  pending: 'En attente',
};

export const emailStatusLabel = (status: EmailStatus): string => EMAIL_STATUS_LABELS[status];

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
