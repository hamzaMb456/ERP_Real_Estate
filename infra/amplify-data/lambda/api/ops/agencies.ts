// Agencies (branches): the manager's admin screen, and the public directory.
import type { Caller } from '../../domain/auth.ts';
import { createBranch, updateBranch } from '../../domain/branches.ts';
import type { Item } from '../../domain/db.ts';
import { byOrg } from '../org-data.ts';
import { sortRows } from '../query-eval.ts';
import type { Op, Vars } from '../registry.ts';
import { ANYONE, WRITERS, mutation, query } from '../registry.ts';

const NAME = { name: 'asc' };
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const agencyFields = (v: Vars) => {
  const o = (v.object ?? v) as Item;
  return { name: str(o.name), slug: (o.slug as string | null) ?? null, city: (o.city as string | null) ?? null, region: (o.region as string | null) ?? null, address: (o.address as string | null) ?? null, phone: (o.phone as string | null) ?? null };
};

export const agencyOps: Record<string, Op> = {
  BranchesAdmin: query(WRITERS, async (c: Caller) => {
    const branches = await byOrg('Branch', c.orgId);
    return {
      branches: sortRows(branches, NAME).map((b) => ({ id: b.id, name: b.name, slug: b.slug ?? null, city: b.city ?? null, region: b.region ?? null, address: b.address ?? null, phone: b.phone ?? null })),
    };
  }),
  SaveBranch: mutation(WRITERS, async (c, v) => {
    const row = v.id ? await updateBranch(c, str(v.id), agencyFields(v)) : await createBranch(c, agencyFields(v));
    return { insert_branches_one: { id: row.id } };
  }),
};

/** Public agencies: the branches that have a public address, for the site's directory and agency pages. */
const publicAgency = (b: Item) => ({ id: b.id, name: b.name, slug: b.slug, city: b.city ?? null, region: b.region ?? null, address: b.address ?? null, phone: b.phone ?? null });

async function publicBranches(orgId: string): Promise<Item[]> {
  if (!orgId) return [];
  return (await byOrg('Branch', orgId)).filter((b) => typeof b.slug === 'string' && b.slug.length > 0);
}

export const publicAgencyOps: Record<string, Op> = {
  PublicAgencies: query(ANYONE, async (_c, v) => ({
    branches: sortRows(await publicBranches(str(v.org_id)), [{ region: 'asc' }, { city: 'asc' }, NAME]).map(publicAgency),
  })),
  PublicAgency: query(ANYONE, async (_c, v) => {
    const found = (await publicBranches(str(v.org_id))).find((b) => b.slug === str(v.slug));
    return { branches: found ? [publicAgency(found)] : [] };
  }),
};
