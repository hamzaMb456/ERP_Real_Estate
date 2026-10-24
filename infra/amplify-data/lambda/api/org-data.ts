// Read helpers shared by the ERP resolvers: everything is loaded per organization, then joined in
// memory into the nested shapes the web's Hasura queries asked for.
import type { Item } from '../domain/db.ts';
import { batchGet, queryAll } from '../domain/db.ts';
import { sortRows } from './hasura-eval.ts';

export const byOrg = (model: string, orgId: string): Promise<Item[]> =>
  queryAll(model, { index: 'byOrg', key: 'organization_id', value: orgId });

export const active = (rows: Item[]): Item[] => rows.filter((r) => !r.archived_at);

export function groupBy(rows: Item[], key: string): Map<string, Item[]> {
  const map = new Map<string, Item[]>();
  for (const r of rows) map.set(r[key], [...(map.get(r[key]) ?? []), r]);
  return map;
}

export async function contactsById(ids: string[]): Promise<Map<string, Item>> {
  return new Map((await batchGet('Contact', ids)).map((c) => [c.id as string, c]));
}

/** current_owners { share_percent contact { id full_name is_organization } } from the unit snapshot. */
export function ownersOf(unit: Item, contacts: Map<string, Item>) {
  return ((unit.current_owners as { contact_id: string; share_percent: number }[] | undefined) ?? []).map((o) => {
    const c = contacts.get(o.contact_id);
    return { share_percent: o.share_percent, contact: { id: o.contact_id, full_name: c?.full_name ?? '', is_organization: c?.is_organization ?? false } };
  });
}

export const ownerIds = (units: Item[]): string[] =>
  units.flatMap((u) => ((u.current_owners as { contact_id: string }[] | undefined) ?? []).map((o) => o.contact_id));

/** Photos of a target, cover first then sort order (the order every photo query uses). */
export const photosOf = (files: Item[] | undefined): Item[] =>
  sortRows((files ?? []).filter((f) => f.kind === 'photo'), [{ is_cover: 'desc' }, { sort_order: 'asc' }]);

/** The active lease of each unit (unit_current_lease). */
export function activeLeaseByUnit(leases: Item[]): Map<string, Item> {
  const map = new Map<string, Item>();
  for (const l of leases.filter((x) => x.status === 'active')) {
    for (const unitId of (l.unit_ids as string[] | undefined) ?? []) map.set(unitId, l);
  }
  return map;
}

export const count = (n: number) => ({ aggregate: { count: n } });
