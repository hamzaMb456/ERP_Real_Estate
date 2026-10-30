import 'server-only';

// Public agencies (branches with a public address): the directory and each agency's page. The public site serves one
// organization, so every query is filtered by it.

import { cacheLife } from 'next/cache';
import { siteConfig } from './config';
import { publicQuery } from './public-api';

export type PublicAgency = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
};

const AGENCIES_QUERY = `
  query PublicAgencies($org_id: String!) {
    branches { id name slug city region address phone }
  }
`;

const AGENCY_QUERY = `
  query PublicAgency($org_id: String!, $slug: String!) {
    branches { id name slug city region address phone }
  }
`;

/** Every agency that has a public address, ordered by region then city. */
export async function getAgencies(): Promise<PublicAgency[]> {
  'use cache';
  cacheLife('hours');
  if (!siteConfig.orgId) return [];
  try {
    const data = await publicQuery<{ branches: PublicAgency[] }>(AGENCIES_QUERY, { org_id: siteConfig.orgId });
    return data.branches;
  } catch {
    return [];
  }
}

/** One agency by its public address (slug), or null. */
export async function getAgency(slug: string): Promise<PublicAgency | null> {
  'use cache';
  cacheLife('hours');
  if (!siteConfig.orgId || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  try {
    const data = await publicQuery<{ branches: PublicAgency[] }>(AGENCY_QUERY, { org_id: siteConfig.orgId, slug });
    return data.branches[0] ?? null;
  } catch {
    return null;
  }
}
