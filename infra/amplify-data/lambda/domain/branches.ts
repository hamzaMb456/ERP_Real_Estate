// Agencies (branches). Only the manager or org_admin writes.
import { randomUUID } from 'node:crypto';
import { requireWriter, type Caller } from './auth.ts';
import type { Item, TxItem } from './db.ts';
import { getItem, queryAll, table, transact } from './db.ts';
import { fail } from './errors.ts';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface BranchInput {
  name: string;
  slug?: string | null;
  city?: string | null;
  region?: string | null;
  address?: string | null;
  phone?: string | null;
}

const text = (value: string | null | undefined): string | null => (value ?? '').trim() || null;

/** Checks the fields of a branch; the slug (the public page address) is lowercase words joined by dashes. */
export function cleanBranch(input: BranchInput): Omit<BranchInput, 'name'> & { name: string; slug: string | null } {
  const name = (input.name ?? '').trim();
  if (!name) fail('branch_name_required');
  const slug = (text(input.slug) ?? '').toLowerCase() || null;
  if (slug && !SLUG.test(slug)) fail('branch_slug_invalid');
  return { name, slug, city: text(input.city), region: text(input.region), address: text(input.address), phone: text(input.phone) };
}

async function branchesOf(orgId: string): Promise<Item[]> {
  return queryAll('Branch', { index: 'byOrg', key: 'organization_id', value: orgId });
}

/** Refuses a name or slug already used by another branch of the organization. */
function assertUnique(fields: { name: string; slug: string | null }, others: Item[]): void {
  if (others.some((b) => String(b.name).toLowerCase() === fields.name.toLowerCase())) fail('branch_name_taken');
  if (fields.slug && others.some((b) => b.slug === fields.slug)) fail('branch_slug_taken');
}

export async function createBranch(caller: Caller, input: BranchInput): Promise<Item> {
  const orgId = requireWriter(caller, 'permission_denied');
  const fields = cleanBranch(input);
  assertUnique(fields, await branchesOf(orgId));
  const row: Item = { __typename: 'Branch', id: randomUUID(), organization_id: orgId, ...fields };
  await transact([{ Put: { TableName: table('Branch'), Item: row } } as TxItem]);
  return row;
}

export async function updateBranch(caller: Caller, id: string, input: BranchInput): Promise<Item> {
  const orgId = requireWriter(caller, 'permission_denied');
  const current = await getItem('Branch', { id });
  if (!current || current.organization_id !== orgId) fail('branch_not_found');
  const fields = cleanBranch(input);
  assertUnique(fields, (await branchesOf(orgId)).filter((b) => b.id !== id));
  const next: Item = { ...current, ...fields };
  await transact([{ Put: { TableName: table('Branch'), Item: next } } as TxItem]);
  return next;
}
