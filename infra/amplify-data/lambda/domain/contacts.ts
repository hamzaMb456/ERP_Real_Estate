import { randomUUID } from 'node:crypto';
import type { Caller } from './auth.ts';
import { requireWriter } from './auth.ts';
import { fail } from './errors.ts';
import type { Item } from './db.ts';
import { getItem, table, transact, updateIfCondition } from './db.ts';
import { checkColumns } from './places.ts';

const ROLES = new Set(['owner', 'renter', 'buyer']);
const CONTACT_RULES = {
  kind: { enum: ['person', 'company'] }, full_name: { text: true, nonEmpty: true }, email: { text: true }, phone: { text: true },
  national_id: { text: true }, address: { text: true }, notes: { text: true }, archived_at: { timestamp: true },
};

function checkRoles(roles: string[]): string[] {
  if (roles.some((r) => !ROLES.has(r))) fail('contact_roles_role_check');
  return [...new Set(roles)];
}

/** is_organization (the agency itself) is never set through the API: one per org, made at signup. */
export async function createContact(caller: Caller, object: Item, roles: string[] = []): Promise<Item> {
  const orgId = requireWriter(caller, 'permission_denied');
  const columns = checkColumns('contacts', CONTACT_RULES, object);
  if (!columns.full_name) fail('contacts_full_name_check');
  const at = new Date().toISOString();
  const contact = {
    __typename: 'Contact', id: randomUUID(), organization_id: orgId, kind: 'person', ...columns, created_by_user_id: caller.userId,
    roles: checkRoles(roles), is_organization: false, archived_at: columns.archived_at ?? null, created_at: at, updated_at: at,
  };
  await transact([{ Put: { TableName: table('Contact'), Item: contact, ConditionExpression: 'attribute_not_exists(id)' } }]);
  return contact;
}

/** Columns plus role changes in one write; the organization's own contact is never archived. */
export async function updateContact(caller: Caller, id: string, set: Item, removeRoles: string[] = [], addRoles: string[] = []): Promise<Item> {
  const orgId = requireWriter(caller, 'permission_denied');
  const current = await getItem('Contact', { id });
  if (current?.organization_id !== orgId) fail('contact_not_found');
  const roles = checkRoles([...((current.roles as string[] | undefined) ?? []).filter((r) => !removeRoles.includes(r)), ...addRoles]);
  const next = { ...current, ...checkColumns('contacts', CONTACT_RULES, set), roles, updated_at: new Date().toISOString() };
  if (next.is_organization && next.archived_at) fail('contacts_self_not_archived');
  await transact([{ Put: { TableName: table('Contact'), Item: next, ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': current.updated_at } } }]);
  return next;
}

/**
 * ensure_owner_role / ensure_renter_role: owning or renting gives the contact that role.
 * Idempotent and outside the caller's transaction (a role is never taken back).
 */
export async function ensureContactRole(contactIds: string[], role: 'owner' | 'renter' | 'buyer'): Promise<void> {
  await Promise.all([...new Set(contactIds)].map((id) => updateIfCondition({
    model: 'Contact',
    Key: { id },
    UpdateExpression: 'SET #r = list_append(if_not_exists(#r, :empty), :added)',
    ConditionExpression: 'attribute_exists(id) AND NOT contains(#r, :role)',
    ExpressionAttributeNames: { '#r': 'roles' },
    ExpressionAttributeValues: { ':empty': [], ':added': [role], ':role': role },
  })));
}
