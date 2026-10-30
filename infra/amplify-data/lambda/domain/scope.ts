// Branch scope: which branches a caller may read or work in. A manager, an org_admin and a viewer see the whole
// organization (null). A regional staff member sees only the branches in their StaffAssignment rows; with none,
// nothing. The organization check stays with each record's owner, this only narrows by branch.
import type { Caller } from './auth.ts';
import { fail } from './errors.ts';
import type { Item } from './db.ts';
import { batchGet, queryAll } from './db.ts';

const ALL_BRANCHES = new Set(['org_admin', 'manager', 'viewer']);

/** Branch ids the caller may use, or null for the whole organization. */
export async function branchScope(caller: Caller): Promise<Set<string> | null> {
  if (ALL_BRANCHES.has(caller.role)) return null;
  const rows = await queryAll('StaffAssignment', { index: 'byUser', key: 'user_id', value: caller.userId });
  return new Set(rows.filter((r) => r.organization_id === caller.orgId).map((r) => String(r.branch_id)));
}

/** True when the branch is inside the scope (null = everything). */
export function inScope(scope: Set<string> | null, branchId: unknown): boolean {
  return scope === null || (typeof branchId === 'string' && scope.has(branchId));
}

/** Keeps only the rows whose branch is inside the scope. */
export function scopedRows(scope: Set<string> | null, rows: Item[], branchOf: (row: Item) => unknown): Item[] {
  return scope === null ? rows : rows.filter((row) => inScope(scope, branchOf(row)));
}

/** Refuses a record whose branch is outside the caller's scope. */
export function assertInScope(scope: Set<string> | null, branchId: unknown): void {
  if (!inScope(scope, branchId)) fail('out_of_scope');
}

/** Unit fields that only a manager may change: prices, fees and deposits. */
export const PRICE_FIELDS = ['rent_amount', 'sale_price', 'charges', 'visit_fee', 'deposit_months', 'reservation_deposit'] as const;

const comparable = (v: unknown): unknown => (v === null || v === undefined || v === '' ? null : Number(v));

/** Price fields whose value in `set` differs from `current` (a form save resends unchanged values, which are fine). */
export function priceChanges(current: Item, set: Item): string[] {
  return PRICE_FIELDS.filter((k) => k in set && comparable(set[k]) !== comparable(current[k]));
}

/** True when every unit sits in a branch inside the scope (null scope: always true). */
export async function unitsInScope(scope: Set<string> | null, unitIds: string[]): Promise<boolean> {
  if (scope === null) return true;
  const ids = [...new Set(unitIds)];
  if (ids.length === 0) return false;
  const units = await batchGet('Unit', ids);
  if (units.length !== ids.length) return false;
  const properties = await batchGet('Property', units.map((u) => u.property_id as string));
  const branchOf = new Map(properties.map((p) => [p.id as string, p.branch_id]));
  return units.every((u) => inScope(scope, branchOf.get(u.property_id as string)));
}
