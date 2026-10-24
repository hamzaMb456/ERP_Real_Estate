// Staff notifications: the daily job (generate_daily_notifications) and the bell's read marks.
// One item per recipient; id = <user_id>#<dedupe_key>, so a conditional put replaces the
// unique (organization, user, dedupe_key) constraint and a second run the same day is a no-op.
import type { Caller } from './auth.ts';
import { addDays, todayTunis, tunisDayOf } from './dates.ts';
import { fail } from './errors.ts';
import type { Item } from './db.ts';
import { doc, getItem, queryAll, scanAll, table, updateIfCondition } from './db.ts';
import { leaseFlags } from './lease-overview.ts';
import type { Lease } from './lease-rules.ts';
import { LEASE_RULES } from './lease-rules.ts';
import { PutCommand } from '@aws-sdk/lib-dynamodb';

const STAFF_ROLES = new Set(['org_admin', 'manager']);
const DAY_SECONDS = 86_400;

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  lease_id: string | null;
  appointment_id: string | null;
  dedupe_key: string;
  read_at: string | null;
  emailed_at: string | null;
  email_error: string | null;
  created_at: string;
  updated_at: string;
  /** DynamoDB TTL, epoch SECONDS (milliseconds would expire the item at once). */
  expires_at: number;
}

export const notificationId = (userId: string, dedupeKey: string): string => `${userId}#${dedupeKey}`;
export const reminderDedupeKey = (appointmentId: string, day: string): string => `appointment_reminder:${appointmentId}:${day}`;

type Draft = Pick<Notification, 'organization_id' | 'user_id' | 'kind' | 'title' | 'link' | 'dedupe_key'>
  & Partial<Pick<Notification, 'lease_id' | 'appointment_id' | 'body'>>;

/** Insert unless that recipient already has this dedupe key; returns the item when inserted. */
export async function insertNotification(draft: Draft, now = new Date()): Promise<Notification | null> {
  const iso = now.toISOString();
  const item: Notification = {
    body: null, lease_id: null, appointment_id: null, ...draft,
    id: notificationId(draft.user_id, draft.dedupe_key),
    read_at: null, emailed_at: null, email_error: null, created_at: iso, updated_at: iso,
    expires_at: Math.floor(now.getTime() / 1000) + LEASE_RULES.notification_retention_days * DAY_SECONDS,
  };
  try {
    await doc.send(new PutCommand({
      TableName: table('Notification'),
      Item: { __typename: 'Notification', ...item },
      ConditionExpression: 'attribute_not_exists(id)',
    }));
    return item;
  } catch (err) {
    if ((err as Error).name === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

async function staffByOrg(): Promise<Map<string, Item[]>> {
  const staff = (await scanAll('StaffMember')).filter((s) => STAFF_ROLES.has(s.role));
  const byOrg = new Map<string, Item[]>();
  for (const s of staff) byOrg.set(s.organization_id, [...(byOrg.get(s.organization_id) ?? []), s]);
  return byOrg;
}

/** The lease events of one day, as in the SQL VALUES list. */
export function leaseEvents(lease: Lease, today: string): { kind: string; dedupe_key: string }[] {
  const flags = leaseFlags(lease, today);
  const expiredOn = addDays(lease.end_date, LEASE_RULES.grace_days + 1);
  const deadline = flags.registration_deadline ?? '';
  return [
    { kind: 'lease_ending_soon', applies: flags.is_ending_soon, dedupe_key: `lease_ending_soon:${lease.id}:${lease.end_date}` },
    { kind: 'lease_grace', applies: flags.in_grace, dedupe_key: `lease_grace:${lease.id}:${lease.end_date}` },
    {
      kind: 'lease_expired',
      applies: lease.status === 'expired' && lease.end_reason === 'expired_auto'
        && expiredOn >= addDays(today, -LEASE_RULES.expired_notice_days),
      dedupe_key: `lease_expired:${lease.id}`,
    },
    { kind: 'registration_due', applies: flags.registration_state === 'due_soon', dedupe_key: `registration_due:${lease.id}:${deadline}` },
    { kind: 'registration_overdue', applies: flags.registration_state === 'overdue', dedupe_key: `registration_overdue:${lease.id}:${deadline}` },
  ].filter((e) => e.applies).map(({ kind, dedupe_key }) => ({ kind, dedupe_key }));
}

/**
 * Daily job, after expireOverdueLeases: lease notifications for every staff member, and
 * reminders for tomorrow's planned appointments (assignee, or all staff when nobody is assigned).
 * Old notifications go away by DynamoDB TTL instead of a delete.
 */
export async function generateDailyNotifications(today = todayTunis()): Promise<Notification[]> {
  const staff = await staffByOrg();
  const inserted: Notification[] = [];
  const add = async (d: Draft) => {
    const n = await insertNotification(d);
    if (n) inserted.push(n);
  };

  const leases = (await scanAll('Lease')).filter((l) => !l.archived_at) as Lease[];
  for (const lease of leases) {
    for (const event of leaseEvents(lease, today)) {
      for (const s of staff.get(lease.organization_id) ?? []) {
        await add({
          organization_id: lease.organization_id, user_id: s.id, kind: event.kind, title: `Bail ${lease.number}`,
          link: `/baux/${lease.id}`, lease_id: lease.id, dedupe_key: event.dedupe_key,
        });
      }
    }
  }

  const tomorrow = addDays(today, 1);
  const planned = await scanAll('Appointment', { expression: '#s = :planned', names: { '#s': 'status' }, values: { ':planned': 'planned' } });
  const now = new Date().toISOString();
  for (const a of planned.filter((x) => tunisDayOf(x.starts_at) === tomorrow)) {
    const recipients = (staff.get(a.organization_id) ?? []).filter((s) => !a.assigned_user_id || s.id === a.assigned_user_id);
    for (const s of recipients) {
      await add({
        organization_id: a.organization_id, user_id: s.id, kind: 'appointment_reminder', title: a.title,
        link: `/calendrier?rendezvous=${a.id}`, appointment_id: a.id, lease_id: a.lease_id ?? null,
        dedupe_key: reminderDedupeKey(a.id, tomorrow),
      });
    }
    await updateIfCondition({
      model: 'Appointment',
      Key: { id: a.id },
      UpdateExpression: 'SET reminder_sent_at = :now',
      ConditionExpression: 'attribute_exists(id)',
      ExpressionAttributeValues: { ':now': now },
    });
  }
  return inserted;
}

/** The bell: mark the caller's own notifications read (all unread ones when no ids are given). */
export async function markNotificationsRead(caller: Caller, ids?: string[]): Promise<number> {
  const staffOrViewer = STAFF_ROLES.has(caller.role) || caller.role === 'viewer';
  if (!caller.orgId || !caller.userId || !staffOrViewer) fail('permission_denied');
  const targets = ids
    ? (await Promise.all(ids.map((id) => getItem('Notification', { id })))).filter((n): n is Item => n !== undefined)
    : await queryAll('Notification', { index: 'byUser', key: 'user_id', value: caller.userId });
  const now = new Date().toISOString();
  let marked = 0;
  for (const n of targets) {
    if (n.user_id !== caller.userId || n.organization_id !== caller.orgId || n.read_at) continue;
    const ok = await updateIfCondition({
      model: 'Notification',
      Key: { id: n.id },
      UpdateExpression: 'SET read_at = :now, updated_at = :now',
      ConditionExpression: 'attribute_exists(id)',
      ExpressionAttributeValues: { ':now': now },
    });
    if (ok) marked += 1;
  }
  return marked;
}
