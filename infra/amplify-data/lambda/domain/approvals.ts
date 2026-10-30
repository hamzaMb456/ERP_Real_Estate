// Lease activation approvals. A regional staff member who cannot activate a lease alone (deposit or documents
// missing) asks instead: a pending LeaseApproval is written. Only a manager or org_admin decides; approving
// activates the lease, rejecting leaves it a draft.
import { randomUUID } from 'node:crypto';
import type { Caller } from './auth.ts';
import { MANAGER_ROLES, requireEditor } from './auth.ts';
import type { Item, TxItem } from './db.ts';
import { getItem, queryAll, table, transact } from './db.ts';
import { fail } from './errors.ts';
import { activateLease } from './leases.ts';

export const NEEDS_APPROVAL = 'lease_activation_needs_approval';
const PENDING = 'pending';

/** The missing items carried by the activation error, or null when the error is something else. */
export function missingFromCode(code: string): string[] | null {
  const prefix = `${NEEDS_APPROVAL}:`;
  return code.startsWith(prefix) ? code.slice(prefix.length).split(',').filter(Boolean) : null;
}

const nowIso = (): string => new Date().toISOString();

async function pendingFor(orgId: string, leaseId: string): Promise<Item | undefined> {
  const rows = await queryAll('LeaseApproval', { index: 'byLease', key: 'lease_id', value: leaseId });
  return rows.find((r) => r.organization_id === orgId && r.status === PENDING);
}

/** Asks for the activation: the pending request for this lease, created once. */
export async function requestApproval(caller: Caller, leaseId: string, signedOn: string | undefined, missing: string[]): Promise<Item> {
  const orgId = requireEditor(caller, 'lease_forbidden');
  const waiting = await pendingFor(orgId, leaseId);
  if (waiting) return waiting;
  const row: Item = {
    __typename: 'LeaseApproval', id: randomUUID(), organization_id: orgId, lease_id: leaseId, status: PENDING,
    requested_by_user_id: caller.userId, requested_at: nowIso(), signed_on: signedOn ?? null, missing,
    decided_by_user_id: null, decided_at: null, decision_note: null,
  };
  await transact([{ Put: { TableName: table('LeaseApproval'), Item: row } } as TxItem]);
  return row;
}

/** Pending requests of the organization, for the manager's queue. */
export async function pendingApprovals(caller: Caller): Promise<Item[]> {
  if (!MANAGER_ROLES.has(caller.role) || !caller.orgId) fail('approval_forbidden');
  const rows = await queryAll('LeaseApproval', { index: 'byOrg', key: 'organization_id', value: caller.orgId });
  return rows.filter((r) => r.status === PENDING);
}

/** The requests a staff member sent, newest first (their own only). */
export async function myApprovals(caller: Caller): Promise<Item[]> {
  const orgId = requireEditor(caller, 'lease_forbidden');
  const rows = await queryAll('LeaseApproval', { index: 'byOrg', key: 'organization_id', value: orgId });
  return rows
    .filter((r) => r.requested_by_user_id === caller.userId)
    .sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)));
}

/** The latest request for a lease, whatever its outcome, shown on the lease page. */
export async function latestApproval(orgId: string, leaseId: string): Promise<Item | null> {
  const rows = await queryAll('LeaseApproval', { index: 'byLease', key: 'lease_id', value: leaseId });
  const own = rows
    .filter((r) => r.organization_id === orgId)
    .sort((a, b) => String(b.requested_at).localeCompare(String(a.requested_at)));
  return own[0] ?? null;
}

/** Manager decision: approve activates the lease, reject closes the request. */
export async function decideApproval(caller: Caller, id: string, decision: 'approve' | 'reject', note?: string | null): Promise<Item> {
  if (!MANAGER_ROLES.has(caller.role) || !caller.orgId) fail('approval_forbidden');
  const row = await getItem('LeaseApproval', { id });
  if (!row || row.organization_id !== caller.orgId) fail('approval_not_found');
  if (row.status !== PENDING) fail('approval_not_pending');
  if (decision === 'approve') await activateLease(caller, row.lease_id as string, (row.signed_on as string | null) ?? undefined);
  const next: Item = {
    ...row, status: decision === 'approve' ? 'approved' : 'rejected',
    decided_by_user_id: caller.userId, decided_at: nowIso(), decision_note: note ?? null,
  };
  await transact([{ Put: { TableName: table('LeaseApproval'), Item: next } } as TxItem]);
  return next;
}
