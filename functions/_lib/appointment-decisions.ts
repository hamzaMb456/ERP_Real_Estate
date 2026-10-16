import type { HasuraEvent } from './event';

export type ParticipantAction = 'invite' | 'skip' | 'none';
export type AppointmentAction = 'cancel' | 'update' | 'none';

/** What the handler read from Hasura about the appointment and the contact. */
export type ParticipantContext = { planned: boolean; notifyByEmail: boolean; email: string | null };

/**
 * Decides what a participant row event asks for.
 * Without `context` the answer is event-only: 'invite' means "candidate, check the conditions";
 * with `context` the conditions are applied and a failing one gives 'skip'.
 */
export function decideParticipantAction(event: HasuraEvent, context?: ParticipantContext): ParticipantAction {
  const row = event.event.data.new;
  const old = event.event.data.old;
  if (event.table.name !== 'appointment_participants' || !row) return 'none';
  if (row.email_status === 'sent') return 'none';
  const op = event.event.op;
  const isInsert = op === 'INSERT' && row.email_status === 'pending';
  const isResend = op === 'UPDATE' && row.email_status === 'pending' && old?.email_status !== 'pending';
  if (!isInsert && !isResend) return 'none';
  if (!context) return 'invite';
  return context.planned && context.notifyByEmail && context.email ? 'invite' : 'skip';
}

// The same instant can be written in two formats; compare as instants when both parse.
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Date.parse(a);
  const right = Date.parse(b);
  return !Number.isNaN(left) && left === right;
}

export function decideAppointmentAction(event: HasuraEvent): AppointmentAction {
  const next = event.event.data.new;
  const old = event.event.data.old;
  if (event.table.name !== 'appointments' || event.event.op !== 'UPDATE' || !next || !old) return 'none';
  if (next.status === 'cancelled' && old.status !== 'cancelled') return 'cancel';
  if (next.status !== 'planned') return 'none';
  const changed = ['starts_at', 'ends_at', 'location'].some((field) => !sameValue(old[field], next[field]));
  return changed ? 'update' : 'none';
}
