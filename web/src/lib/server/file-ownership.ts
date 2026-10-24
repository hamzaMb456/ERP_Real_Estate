import 'server-only';
import { BUCKET, LEASE_BUCKET } from '@/lib/storage-buckets';

function graphqlUrl(): string {
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  return `https://${subdomain}.graphql.${region}.nhost.run/v1`;
}

const OWNERSHIP_QUERY = `
  query StorageFileOwnership($key: uuid!) {
    property_files(where: { storage_file_id: { _eq: $key } }, limit: 1) { id }
    lease_files(where: { storage_file_id: { _eq: $key } }, limit: 1) { id }
  }
`;

type OwnershipResponse = { data?: { property_files?: unknown[]; lease_files?: unknown[] } };

/**
 * Resolves which bucket a storage key lives in by checking which table's row references it, using
 * the CALLER's own bearer token so Hasura applies the caller's own row-level permissions, not ours.
 * Returns null when no row the caller can see references the key — covers both "never existed" and
 * "exists but belongs to another tenant", so a guessed/leaked uuid can't be used to read or delete
 * someone else's file.
 */
export async function resolveStorageKeyBucket(token: string, key: string): Promise<string | null> {
  const response = await fetch(graphqlUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query: OWNERSHIP_QUERY, variables: { key } }),
  });
  if (!response.ok) return null;
  const body = (await response.json().catch(() => null)) as OwnershipResponse | null;
  if ((body?.data?.property_files?.length ?? 0) > 0) return BUCKET;
  if ((body?.data?.lease_files?.length ?? 0) > 0) return LEASE_BUCKET;
  return null;
}
