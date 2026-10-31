// Appointments and their participants, ported from db/migrations/0004_calendar_notifications.sql.
import { randomUUID } from 'node:crypto';
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import type { Caller } from './auth.ts';
import { MANAGER_ROLES, requireWriter } from './auth.ts';
import { isIsoDateTime, tunisDayOf } from './dates.ts';
import { fail } from './errors.ts';
import type { Item, TxItem } from './db.ts';
import { batchGet, doc, getItem, queryAll, table, transact, updateIfCondition } from './db.ts';
import { reminderDedupeKey, notificationId } from './notifications.ts';

const KINDS = new Set(['viewing', 'move_in', 'move_out', 'meeting', 'other']);
const STATUSES = new Set(['planned', 'done', 'cancelled']);
const PARTICIPANT_ROLES = new Set(['renter', 'guarantor', 'prospect', 'buyer', 'other']);
const FORBIDDEN = 'permission_denied';
const BATCH_WRITE_LIMIT = 25;

export interface ParticipantInput {
  contact_id: string;
  role: string;
}

export interface AppointmentInput {
  /** An existing appointment to update. */
  id?: string;
  /** For a new appointment: the id the client chose. */
  create_id?: string;
  kind: string;
  title: string;
  location?: string | null;
  starts_at: string;
  ends_at: string;
  status?: string;
  assigned_user_id?: string | null;
  unit_id?: string | null;
  lease_id?: string | null;
  notify_by_email?: boolean;
  notes?: string | null;
  /** When present, the full participant list (added ones get an invitation, removed ones are dropped). */
  participants?: ParticipantInput[];
}

export function validateAppointment(a: AppointmentInput): void {
  if (!KINDS.has(a.kind)) fail('appointments_kind_check');
  if (typeof a.title !== 'string' || a.title.trim() === '') fail('appointments_title_check');
  if (a.status !== undefined && !STATUSES.has(a.status)) fail('appointments_status_check');
  if (!isIsoDateTime(a.starts_at) || !isIsoDateTime(a.ends_at)) fail('appointments_dates_check');
  if (Date.parse(a.ends_at) <= Date.parse(a.starts_at)) fail('appointments_dates_check');
  const contacts = new Set<string>();
  for (const p of a.participants ?? []) {
    if (!PARTICIPANT_ROLES.has(p.role)) fail('appointment_participants_role_check');
    if (contacts.has(p.contact_id)) fail('appointment_participants_pkey');
    contacts.add(p.contact_id);
  }
}

/** Every reference must belong to the caller's organization; the assignee must be a manager of the organization. */
async function assertReferences(orgId: string, a: AppointmentInput): Promise<void> {
  const [unit, lease, assignee, contacts] = await Promise.all([
    a.unit_id ? getItem('Unit', { id: a.unit_id }) : undefined,
    a.lease_id ? getItem('Lease', { id: a.lease_id }) : undefined,
    a.assigned_user_id ? getItem('StaffMember', { id: a.assigned_user_id }) : undefined,
    batchGet('Contact', (a.participants ?? []).map((p) => p.contact_id)),
  ]);
  if (a.unit_id && unit?.organization_id !== orgId) fail('unit_not_found');
  if (a.lease_id && lease?.organization_id !== orgId) fail('lease_not_found');
  // check_appointment_assignee
  if (a.assigned_user_id && !(assignee?.organization_id === orgId && MANAGER_ROLES.has(assignee?.role))) fail('appointment_assignee_invalid');
  if (contacts.length !== (a.participants ?? []).length || contacts.some((c) => c.organization_id !== orgId)) fail('contact_not_found');
}

async function deleteMany(model: string, keys: Item[]): Promise<void> {
  for (let i = 0; i < keys.length; i += BATCH_WRITE_LIMIT) {
    let requests: Item[] | undefined = keys.slice(i, i + BATCH_WRITE_LIMIT).map((Key) => ({ DeleteRequest: { Key } }));
    while (requests && requests.length > 0) {
      const out = await doc.send(new BatchWriteCommand({ RequestItems: { [table(model)]: requests } }));
      requests = out.UnprocessedItems?.[table(model)] as Item[] | undefined;
    }
  }
}

/** The reminder of one appointment day, for every manager of the org (ids are deterministic). */
async function dropReminders(orgId: string, appointmentId: string, startsAt: string): Promise<void> {
  const managers = await queryAll('StaffMember', { index: 'byOrg', key: 'organization_id', value: orgId });
  const key = reminderDedupeKey(appointmentId, tunisDayOf(startsAt));
  await deleteMany('Notification', managers.map((s) => ({ id: notificationId(s.id, key) })));
}

/** Create or update an appointment (and optionally its participants) in one transaction. */
export async function saveAppointment(caller: Caller, input: AppointmentInput): Promise<Item> {
  const orgId = requireWriter(caller, FORBIDDEN);
  validateAppointment(input);
  const existing = input.id ? await getItem('Appointment', { id: input.id }) : undefined;
  if (input.id && existing?.organization_id !== orgId) fail('appointment_not_found');
  await assertReferences(orgId, input);

  const now = new Date().toISOString();
  if (!existing && input.create_id !== undefined && !/^[0-9a-f-]{36}$/i.test(input.create_id)) fail('appointment_invalid_id');
  const id = existing?.id ?? input.create_id ?? randomUUID();
  const next = {
    __typename: 'Appointment',
    id,
    organization_id: orgId,
    kind: input.kind,
    title: input.title.trim(),
    location: input.location?.trim() || null,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    status: input.status ?? existing?.status ?? 'planned',
    assigned_user_id: input.assigned_user_id ?? null,
    unit_id: input.unit_id ?? null,
    lease_id: input.lease_id ?? null,
    notify_by_email: input.notify_by_email ?? existing?.notify_by_email ?? true,
    reminder_sent_at: existing?.reminder_sent_at ?? null,
    notes: input.notes?.trim() || null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  const items: TxItem[] = [{
    Put: {
      TableName: table('Appointment'),
      Item: next,
      ...(existing
        ? { ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': existing.updated_at } }
        : { ConditionExpression: 'attribute_not_exists(id)' }),
    },
  }];
  if (input.participants) {
    const current = existing ? await queryAll('AppointmentParticipant', { key: 'appointment_id', value: id }) : [];
    const currentBy = new Map(current.map((p) => [p.contact_id as string, p]));
    const wanted = new Set(input.participants.map((p) => p.contact_id));
    for (const p of current.filter((c) => !wanted.has(c.contact_id))) {
      items.push({ Delete: { TableName: table('AppointmentParticipant'), Key: { appointment_id: id, contact_id: p.contact_id } } });
    }
    for (const p of input.participants) {
      const kept = currentBy.get(p.contact_id);
      if (kept && kept.role === p.role) continue;
      items.push({
        Put: {
          TableName: table('AppointmentParticipant'),
          Item: {
            __typename: 'AppointmentParticipant', appointment_id: id, contact_id: p.contact_id, organization_id: orgId, role: p.role,
            email_status: kept?.email_status ?? 'pending', email_error: kept?.email_error ?? null,
            created_at: kept?.created_at ?? now, updated_at: now,
          },
        },
      });
    }
  }
  await transact(items);

  // drop_stale_appointment_reminders: cancelled, done or moved to another Tunis day.
  if (existing && (next.status !== 'planned' || tunisDayOf(existing.starts_at) !== tunisDayOf(next.starts_at))) {
    await dropReminders(orgId, id, existing.starts_at);
  }
  return next;
}

/** Re-send an invitation: the e-mail pipeline picks participants back up when they turn pending. */
export async function resendInvitation(caller: Caller, appointmentId: string, contactId: string): Promise<void> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const updated = await updateIfCondition({
    model: 'AppointmentParticipant',
    Key: { appointment_id: appointmentId, contact_id: contactId },
    UpdateExpression: 'SET email_status = :pending, email_error = :none, updated_at = :now',
    ConditionExpression: 'organization_id = :org',
    ExpressionAttributeValues: { ':pending': 'pending', ':none': null, ':now': new Date().toISOString(), ':org': orgId },
  });
  if (!updated) fail('appointment_participant_not_found');
}

/** Delete an appointment with its participants and reminders (the cascades in SQL). */
export async function deleteAppointment(caller: Caller, id: string): Promise<void> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const existing = await getItem('Appointment', { id });
  if (existing?.organization_id !== orgId) fail('appointment_not_found');
  const participants = await queryAll('AppointmentParticipant', { key: 'appointment_id', value: id });
  await transact([
    { Delete: { TableName: table('Appointment'), Key: { id }, ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': existing.updated_at } } },
    ...participants.map((p): TxItem => ({ Delete: { TableName: table('AppointmentParticipant'), Key: { appointment_id: id, contact_id: p.contact_id } } })),
  ]);
  await dropReminders(orgId, id, existing.starts_at);
}
