import type { AppointmentKind, AppointmentStatus, ParticipantRole } from '@/lib/appointment-types';
import { graphql } from '@/lib/graphql';

export type ParticipantInput = { contactId: string; role: ParticipantRole };

/** The appointment columns a client may write, in Hasura's snake_case. */
export type AppointmentFields = {
  kind: AppointmentKind;
  title: string;
  location: string | null;
  starts_at: string;
  ends_at: string;
  assigned_user_id: string | null;
  unit_id: string | null;
  lease_id: string | null;
  notify_by_email: boolean;
  notes: string | null;
};

const INSTANT_FIELDS: (keyof AppointmentFields)[] = ['starts_at', 'ends_at'];

const sameValue = (key: keyof AppointmentFields, a: AppointmentFields, b: AppointmentFields): boolean =>
  INSTANT_FIELDS.includes(key) ? Date.parse(a[key] as string) === Date.parse(b[key] as string) : a[key] === b[key];

/** The fields of `after` that differ from `before` (instants compared as instants). */
export function changedFields(before: AppointmentFields, after: AppointmentFields): Partial<AppointmentFields> {
  const changed: Partial<AppointmentFields> = {};
  for (const key of Object.keys(after) as (keyof AppointmentFields)[]) {
    if (!sameValue(key, before, after)) Object.assign(changed, { [key]: after[key] });
  }
  return changed;
}

/**
 * What to delete and insert to go from one participant set to another. A role cannot be updated by
 * clients, so a contact whose role changed is removed and added again; an untouched contact is left
 * alone (touching it would send the invitation again).
 */
export function diffParticipants(
  before: ParticipantInput[],
  after: ParticipantInput[],
): { added: ParticipantInput[]; removed: string[] } {
  const roleBefore = new Map(before.map((participant) => [participant.contactId, participant.role]));
  const roleAfter = new Map(after.map((participant) => [participant.contactId, participant.role]));
  const added = after.filter((participant) => roleBefore.get(participant.contactId) !== participant.role);
  const removed = before
    .filter((participant) => roleAfter.get(participant.contactId) !== participant.role)
    .map((participant) => participant.contactId);
  return { added, removed };
}

const toRows = (appointmentId: string, participants: ParticipantInput[]) =>
  participants.map((participant) => ({ appointment_id: appointmentId, contact_id: participant.contactId, role: participant.role }));

const INSERT_APPOINTMENT = `
  mutation InsertAppointment($appointment: appointments_insert_input!, $participants: [appointment_participants_insert_input!]!) {
    insert_appointments_one(object: $appointment) { id }
    insert_appointment_participants(objects: $participants) { affected_rows }
  }
`;

/** Creates the appointment and its participants in one request (the client picks the id). */
export async function insertAppointmentMutation(
  id: string,
  fields: AppointmentFields,
  participants: ParticipantInput[],
): Promise<void> {
  await graphql(INSERT_APPOINTMENT, { appointment: { id, ...fields }, participants: toRows(id, participants) });
}

/** Only the root fields that have something to do: an empty _set or _in would be rejected or pointless. */
function updateQuery(hasSet: boolean, hasRemove: boolean, hasAdd: boolean): string {
  const variables = [
    '$id: uuid!',
    hasSet ? '$set: appointments_set_input!' : '',
    hasRemove ? '$remove: [uuid!]!' : '',
    hasAdd ? '$add: [appointment_participants_insert_input!]!' : '',
  ].filter(Boolean);
  // Hasura runs the root fields of a mutation in order: update, delete, then insert.
  const roots = [
    hasSet ? 'update_appointments_by_pk(pk_columns: { id: $id }, _set: $set) { id }' : '',
    hasRemove
      ? 'delete_appointment_participants(where: { appointment_id: { _eq: $id }, contact_id: { _in: $remove } }) { affected_rows }'
      : '',
    hasAdd ? 'insert_appointment_participants(objects: $add) { affected_rows }' : '',
  ].filter(Boolean);
  return `mutation UpdateAppointment(${variables.join(', ')}) { ${roots.join(' ')} }`;
}

/**
 * Saves what changed on an appointment, and only that: the changed columns, the participants who left
 * and the ones who joined, in one request. Nothing changed, no request.
 */
export async function updateAppointmentMutation(
  id: string,
  changes: Partial<AppointmentFields>,
  diff: { added: ParticipantInput[]; removed: string[] },
): Promise<void> {
  const hasSet = Object.keys(changes).length > 0;
  const hasRemove = diff.removed.length > 0;
  const hasAdd = diff.added.length > 0;
  if (!hasSet && !hasRemove && !hasAdd) return;
  await graphql(updateQuery(hasSet, hasRemove, hasAdd), {
    id,
    ...(hasSet ? { set: changes } : {}),
    ...(hasRemove ? { remove: diff.removed } : {}),
    ...(hasAdd ? { add: toRows(id, diff.added) } : {}),
  });
}

const SET_STATUS = `
  mutation SetAppointmentStatus($id: uuid!, $status: String!) {
    update_appointments_by_pk(pk_columns: { id: $id }, _set: { status: $status }) { id }
  }
`;

export async function setAppointmentStatusMutation(id: string, status: AppointmentStatus): Promise<void> {
  await graphql(SET_STATUS, { id, status });
}

const RESEND_PARTICIPANT = `
  mutation ResendParticipant($appointmentId: uuid!, $contactId: uuid!) {
    update_appointment_participants_by_pk(
      pk_columns: { appointment_id: $appointmentId, contact_id: $contactId }
      _set: { email_status: "pending" }
    ) { appointment_id }
  }
`;

/** « Renvoyer »: puts the e-mail back to pending; the event trigger sends it again. */
export async function resendParticipantMutation(appointmentId: string, contactId: string): Promise<void> {
  await graphql(RESEND_PARTICIPANT, { appointmentId, contactId });
}
