// Ownership operations on DynamoDB. All changes to one unit's ownerships commit together under
// the unit's ownership lock, so the 100 % cap is checked against a consistent set (the deferred
// constraint trigger in SQL); a transfer (end one owner, start another) is one change.
import { randomUUID } from 'node:crypto';
import type { Caller } from './auth.ts';
import { requireEditor } from './auth.ts';
import { ensureContactRole } from './contacts.ts';
import { addDays, todayTunis } from './dates.ts';
import { fail } from './errors.ts';
import type { Item, TxItem } from './db.ts';
import { batchGet, getItem, scanAll, table, transact, versionBump } from './db.ts';
import type { Ownership } from './ownership-rules.ts';
import { assertNoContactOverlap, assertSharesCap, currentOwners, validateOwnership } from './ownership-rules.ts';

export interface OwnershipInput {
  id?: string;
  contact_id: string;
  share_percent: number;
  starts_on: string;
  ends_on?: string | null;
  notes?: string | null;
}

export interface OwnershipChange {
  upsert?: OwnershipInput[];
  remove?: string[];
}

const FORBIDDEN = 'permission_denied';
/** One change = lock + unit + upserts + removals: keep it well under DynamoDB's 100 items. */
const MAX_CHANGES = 40;
const ownLockId = (unitId: string): string => `UNITOWN#${unitId}`;

/** The lock item also holds the unit's ownership ids, so the set is read consistently (no GSI lag). */
const lockItem = (unitId: string, seen: number | undefined, rows: Ownership[]): TxItem =>
  versionBump(ownLockId(unitId), seen, undefined, { ownership_ids: rows.map((r) => r.id) });

async function unitOwnerships(lock: Item | undefined): Promise<Ownership[]> {
  return (await batchGet('Ownership', (lock?.ownership_ids as string[] | undefined) ?? [])) as Ownership[];
}

function ownersItem(unitId: string, rows: Ownership[], today: string, now: string): TxItem {
  return {
    Update: {
      TableName: table('Unit'),
      Key: { id: unitId },
      UpdateExpression: 'SET current_owners = :owners, updated_at = :now',
      ConditionExpression: 'attribute_exists(id)',
      ExpressionAttributeValues: { ':owners': currentOwners(rows, today), ':now': now },
    },
  };
}

/** Add, edit and remove ownerships of one unit atomically; returns the unit's ownerships after. */
export async function changeOwnerships(
  caller: Caller,
  unitId: string,
  change: OwnershipChange,
  today = todayTunis(),
): Promise<Ownership[]> {
  const orgId = requireEditor(caller, FORBIDDEN);
  const upserts = change.upsert ?? [];
  const removals = new Set(change.remove ?? []);
  if (upserts.length + removals.size > MAX_CHANGES) fail('ownership_too_many_changes');

  const [unit, lock, contacts] = await Promise.all([
    getItem('Unit', { id: unitId }),
    getItem('Lock', { id: ownLockId(unitId) }),
    batchGet('Contact', upserts.map((u) => u.contact_id)),
  ]);
  const rows = await unitOwnerships(lock);
  if (!unit || unit.organization_id !== orgId) fail('unit_not_found');
  const contactIds = new Set(contacts.filter((c) => c.organization_id === orgId).map((c) => c.id as string));
  if (upserts.some((u) => !contactIds.has(u.contact_id))) fail('contact_not_found');

  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of removals) if (!byId.has(id)) fail('ownership_not_found');

  const now = new Date().toISOString();
  const changed: { next: Ownership; previous?: Ownership }[] = upserts.map((u) => {
    const previous = u.id ? byId.get(u.id) : undefined;
    if (u.id && !previous) fail('ownership_not_found');
    const next: Ownership = {
      id: previous?.id ?? randomUUID(),
      organization_id: orgId,
      unit_id: unitId,
      contact_id: u.contact_id,
      share_percent: u.share_percent,
      starts_on: u.starts_on,
      ends_on: u.ends_on ?? null,
      notes: u.notes?.trim() || null,
      created_at: previous?.created_at ?? now,
      updated_at: now,
    };
    validateOwnership(next);
    return { next, previous };
  });

  const changedIds = new Set(changed.map((c) => c.next.id));
  const after = [
    ...rows.filter((r) => !removals.has(r.id) && !changedIds.has(r.id)),
    ...changed.map((c) => c.next),
  ];
  assertNoContactOverlap(after);
  assertSharesCap(after);

  await transact([
    lockItem(unitId, lock?.value as number | undefined, after),
    ...changed.map(({ next, previous }): TxItem => ({
      Put: {
        TableName: table('Ownership'),
        Item: { __typename: 'Ownership', ...next },
        ...(previous
          ? { ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': previous.updated_at } }
          : { ConditionExpression: 'attribute_not_exists(id)' }),
      },
    })),
    ...[...removals].map((id): TxItem => ({
      Delete: { TableName: table('Ownership'), Key: { id }, ConditionExpression: 'attribute_exists(id)' },
    })),
    ownersItem(unitId, after, today, now),
  ]);
  await ensureContactRole(changed.map((c) => c.next.contact_id), 'owner');
  return after;
}

/**
 * Daily job: `current_owners` on a unit is a snapshot of "today", so refresh the units where an
 * ownership starts today or ended yesterday.
 */
export async function refreshCurrentOwners(today = todayTunis()): Promise<{ refreshed: number; failed: string[] }> {
  const boundary = await scanAll('Ownership', {
    expression: 'starts_on = :today OR ends_on = :yesterday',
    values: { ':today': today, ':yesterday': addDays(today, -1) },
  });
  const unitIds = [...new Set(boundary.map((o) => o.unit_id as string))];
  const failed: string[] = [];
  let refreshed = 0;
  for (const unitId of unitIds) {
    try {
      const lock = await getItem('Lock', { id: ownLockId(unitId) });
      const rows = await unitOwnerships(lock);
      await transact([lockItem(unitId, lock?.value as number | undefined, rows), ownersItem(unitId, rows, today, new Date().toISOString())]);
      refreshed += 1;
    } catch (err) {
      console.error(`refreshCurrentOwners: unit ${unitId} failed:`, (err as Error).message);
      failed.push(unitId);
    }
  }
  return { refreshed, failed };
}
