// Records behind regional staff accounts: the staff member, their agencies, invitations and the activity trail.
// The login itself (Cognito) is handled by server routes; everything here is DynamoDB and runs for a manager or org_admin,
// except the two public steps that follow an invitation link.
import { randomUUID } from 'node:crypto';
import type { Caller } from './auth.ts';
import { requireWriter } from './auth.ts';
import type { Item, TxItem } from './db.ts';
import { getItem, queryAll, table, transact } from './db.ts';
import { fail } from './errors.ts';
import { checkToken, newInvitation, proofMatches } from './staff-invitations.ts';

export type StaffStatus = 'invited' | 'confirmed' | 'disabled';
export type ActivityKind = 'created' | 'invited' | 'resent' | 'activated' | 'disabled' | 'mfa_reset' | 'branches_changed';

const FORBIDDEN = 'permission_denied';
const ACTIVITY_LIMIT = 200;

const nowIso = (): string => new Date().toISOString();
const put = (model: string, item: Item): TxItem => ({ Put: { TableName: table(model), Item: { __typename: model, ...item } } });

/** `disabled` wins over `confirmed`, which wins over `invited`. */
export function staffStatus(member: Item): StaffStatus {
  if (member.disabled_at) return 'disabled';
  return member.confirmed_at ? 'confirmed' : 'invited';
}

/** One row of the activity trail. Exported so other writers (agency changes) can add to the same trail. */
export function activityItem(orgId: string, userId: string, kind: ActivityKind, actorUserId: string, detail?: string): TxItem {
  return put('StaffActivity', {
    id: randomUUID(), organization_id: orgId, user_id: userId, kind, actor_user_id: actorUserId, created_at: nowIso(), detail: detail ?? null,
  });
}

async function memberOf(orgId: string, userId: string): Promise<Item> {
  const member = userId ? await getItem('StaffMember', { id: userId }) : undefined;
  if (!member || member.organization_id !== orgId || member.role !== 'staff') fail('staff_not_found');
  return member;
}

/** Invitations of this user that can still be used. */
async function openInvitations(orgId: string, userId: string): Promise<Item[]> {
  const rows = await queryAll('StaffInvitation', { index: 'byUser', key: 'user_id', value: userId });
  return rows.filter((r) => r.organization_id === orgId && !r.used_at && !r.revoked_at);
}

/** Revokes every open invitation and, when asked, adds a new one. Returns the new invitation id. */
async function reissue(caller: Caller, orgId: string, member: Item, issue: boolean): Promise<{ items: TxItem[]; invitationId: string | null }> {
  const at = nowIso();
  const items = (await openInvitations(orgId, member.id)).map((row) => put('StaffInvitation', { ...row, revoked_at: at }));
  if (!issue) return { items, invitationId: null };
  const next = newInvitation(new Date());
  items.push(put('StaffInvitation', {
    id: next.id, organization_id: orgId, user_id: member.id, email: member.email, display_name: member.display_name,
    expires_at: next.expires_at, used_at: null, revoked_at: null, created_by_user_id: caller.userId, created_at: at,
  }));
  return { items, invitationId: next.id };
}

export interface CreateStaffInput {
  user_id: string;
  email: string;
  display_name: string;
  branch_ids: string[];
}

/** The staff member, their agencies and a first invitation, in one write. The login already exists in Cognito. */
export async function createStaffRecord(caller: Caller, input: CreateStaffInput): Promise<{ invitation_id: string }> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const email = (input.email ?? '').trim();
  const name = (input.display_name ?? '').trim();
  if (!email.includes('@')) fail('staff_email_required');
  if (!name) fail('staff_name_required');
  if (!input.user_id) fail('staff_not_found');
  if (await getItem('StaffMember', { id: input.user_id })) fail('staff_exists');

  const branches = await queryAll('Branch', { index: 'byOrg', key: 'organization_id', value: orgId });
  const valid = new Set(branches.map((b) => b.id as string));
  const wanted = [...new Set(input.branch_ids ?? [])];
  if (wanted.some((id) => !valid.has(id))) fail('branch_not_found');

  const member: Item = { id: input.user_id, organization_id: orgId, display_name: name, email, role: 'staff', confirmed_at: null, disabled_at: null };
  const { items: invitation, invitationId } = await reissue(caller, orgId, member, true);
  await transact([
    put('StaffMember', member),
    ...wanted.map((branch_id) => put('StaffAssignment', { id: randomUUID(), organization_id: orgId, user_id: member.id, branch_id, role: 'staff' })),
    ...invitation,
    activityItem(orgId, member.id, 'created', caller.userId),
    activityItem(orgId, member.id, 'invited', caller.userId),
  ]);
  return { invitation_id: invitationId as string };
}

/** A new link; the previous one stops working. Not for an account already confirmed or disabled. */
export async function resendInvitation(caller: Caller, userId: string): Promise<{ invitation_id: string }> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const member = await memberOf(orgId, userId);
  if (member.disabled_at) fail('staff_disabled');
  if (member.confirmed_at) fail('staff_already_confirmed');
  const { items, invitationId } = await reissue(caller, orgId, member, true);
  await transact([...items, activityItem(orgId, member.id, 'resent', caller.userId)]);
  return { invitation_id: invitationId as string };
}

/** Kill switch, record side: agencies removed, links revoked, member marked disabled. */
export async function offboardStaff(caller: Caller, userId: string): Promise<void> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const member = await memberOf(orgId, userId);
  const assignments = await queryAll('StaffAssignment', { index: 'byUser', key: 'user_id', value: userId });
  const { items } = await reissue(caller, orgId, member, false);
  await transact([
    ...assignments.map((a) => ({ Delete: { TableName: table('StaffAssignment'), Key: { id: a.id } } }) as TxItem),
    ...items,
    put('StaffMember', { ...member, disabled_at: nowIso() }),
    activityItem(orgId, member.id, 'disabled', caller.userId),
  ]);
}

/** Lost phone: the second step is cleared and a fresh link lets the person enrol again. */
export async function resetStaffMfa(caller: Caller, userId: string): Promise<{ invitation_id: string }> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const member = await memberOf(orgId, userId);
  if (member.disabled_at) fail('staff_disabled');
  const { items, invitationId } = await reissue(caller, orgId, member, true);
  await transact([
    put('StaffMember', { ...member, confirmed_at: null }),
    ...items,
    activityItem(orgId, member.id, 'mfa_reset', caller.userId),
  ]);
  return { invitation_id: invitationId as string };
}

export type InvitationLookup = { ok: true; user_id: string; organization_id: string; email: string; display_name: string } | { ok: false };

/** Public step: is this link valid? The same answer for every kind of failure. */
export async function checkInvitation(env: { INVITE_SECRET?: string }, token: string): Promise<InvitationLookup> {
  const secret = env.INVITE_SECRET ?? '';
  const id = typeof token === 'string' ? token.split('.')[0] : '';
  if (!secret || !id || !token.includes('.')) return { ok: false };
  const row = await getItem('StaffInvitation', { id });
  if (!row || !checkToken(secret, token, row as never, new Date()).ok) return { ok: false };
  return { ok: true, user_id: row.user_id, organization_id: row.organization_id, email: row.email, display_name: row.display_name };
}

/**
 * Public step, after the server verified the authenticator code: the link is used up and the member is confirmed.
 * Holding the link is not enough: the web server adds a proof only it can compute, so nobody can confirm without the code.
 */
export async function confirmActivation(env: { INVITE_SECRET?: string }, token: string, proof: string): Promise<{ ok: boolean }> {
  if (!env.INVITE_SECRET || !proofMatches(env.INVITE_SECRET, String(token).split('.')[0], proof)) return { ok: false };
  const found = await checkInvitation(env, token);
  if (!found.ok) return { ok: false };
  const row = (await getItem('StaffInvitation', { id: token.split('.')[0] })) as Item;
  const member = await getItem('StaffMember', { id: found.user_id });
  if (!member || member.disabled_at) return { ok: false };
  const at = nowIso();
  await transact([
    put('StaffInvitation', { ...row, used_at: at }),
    put('StaffMember', { ...member, confirmed_at: at }),
    activityItem(row.organization_id, found.user_id, 'activated', found.user_id),
  ]);
  return { ok: true };
}

/** The trail, newest first, for the manager's screen. */
export async function listStaffActivity(caller: Caller): Promise<Item[]> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const rows = await queryAll('StaffActivity', { index: 'byOrg', key: 'organization_id', value: orgId });
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, ACTIVITY_LIMIT);
}

/** A staff member of the caller's organization: how the server finds the Cognito username without trusting the browser. */
export async function lookupStaff(caller: Caller, userId: string): Promise<{ user_id: string; email: string; display_name: string }> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const member = await memberOf(orgId, userId);
  return { user_id: member.id, email: member.email, display_name: member.display_name };
}

/**
 * Every call by a regional staff member first checks that the account is still active. Disabling a member must end
 * their open sessions at once, and the ID token a session holds stays valid for up to an hour on its own.
 */
export async function assertActiveStaff(
  caller: Caller,
  lookup: (id: string) => Promise<Item | undefined> = (id) => getItem('StaffMember', { id }),
): Promise<void> {
  if (caller.role !== 'staff') return;
  const member = await lookup(caller.userId);
  if (!member || member.organization_id !== caller.orgId || member.disabled_at) fail('permission_denied');
}
