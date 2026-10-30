// What a regional staff member can see of the units and of the people linked to them. The manager and org_admin see
// everything (null sets). A contact is visible to staff when it is linked to a unit or a lease of their branches
// (current owner, lease party), or when the staff member created it.
import type { Caller } from './auth.ts';
import type { Item } from './db.ts';
import { batchGet, getItem, queryAll } from './db.ts';
import { branchScope, inScope } from './scope.ts';

/** Units the caller may use, or null for every unit of the organization. */
export async function unitIdsInScope(caller: Caller): Promise<Set<string> | null> {
  const scope = await branchScope(caller);
  if (scope === null) return null;
  const [units, properties] = await Promise.all([
    queryAll('Unit', { index: 'byOrg', key: 'organization_id', value: caller.orgId }),
    queryAll('Property', { index: 'byOrg', key: 'organization_id', value: caller.orgId }),
  ]);
  const branchOf = new Map(properties.map((p) => [p.id as string, p.branch_id]));
  return new Set(units.filter((u) => inScope(scope, branchOf.get(u.property_id as string))).map((u) => u.id as string));
}

/** True when a record that points at this unit is visible (null set: always). */
export function unitVisible(units: Set<string> | null, unitId: unknown): boolean {
  return units === null || (typeof unitId === 'string' && units.has(unitId));
}

/** Contacts the caller may see, or null for all of them. Built from the units in scope (see the header). */
export async function contactIdsInScope(caller: Caller, units: Set<string> | null): Promise<Set<string> | null> {
  if (units === null) return null;
  const ids = new Set<string>();
  if (units.size > 0) {
    for (const unit of await batchGet('Unit', [...units])) {
      for (const owner of (unit.current_owners as { contact_id: string }[] | undefined) ?? []) ids.add(owner.contact_id);
    }
    const leases = await queryAll('Lease', { index: 'byOrg', key: 'organization_id', value: caller.orgId });
    for (const lease of leases) {
      if (!((lease.unit_ids as string[] | undefined) ?? []).some((id) => units.has(id))) continue;
      for (const party of await queryAll('LeaseParty', { key: 'lease_id', value: lease.id })) ids.add(party.contact_id as string);
    }
  }
  for (const contact of await queryAll('Contact', { index: 'byOrg', key: 'organization_id', value: caller.orgId })) {
    if (contact.created_by_user_id === caller.userId) ids.add(contact.id as string);
  }
  return ids;
}

/** True when the contact is visible (null set: always). */
export function contactVisible(ids: Set<string> | null, contact: Item): boolean {
  return ids === null || ids.has(contact.id as string);
}

/** True when the file's target (a unit, a property or a lease) sits in the caller's branches. Null scope: always. */
export async function fileTargetVisible(caller: Caller, target: Item): Promise<boolean> {
  const units = await unitIdsInScope(caller);
  if (units === null) return true;
  if (typeof target.unit_id === 'string') return units.has(target.unit_id);
  if (typeof target.property_id === 'string') {
    const property = await getItem('Property', { id: target.property_id });
    return inScope(await branchScope(caller), property?.branch_id);
  }
  if (typeof target.lease_id === 'string') {
    const lease = await getItem('Lease', { id: target.lease_id });
    const ids = (lease?.unit_ids as string[] | undefined) ?? [];
    return ids.length > 0 && ids.every((id) => units.has(id));
  }
  return false;
}
