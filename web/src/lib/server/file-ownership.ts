import 'server-only';
import { appsyncRequest } from '@/lib/backend';
import { BUCKET, LEASE_BUCKET } from '@/lib/storage-buckets';

const OWNERSHIP_QUERY = `
  query StorageFileOwnership($key: uuid!) {
    property_files(where: { storage_file_id: { _eq: $key } }, limit: 1) { id }
    lease_files(where: { storage_file_id: { _eq: $key } }, limit: 1) { id }
  }
`;

type OwnershipData = { property_files?: unknown[]; lease_files?: unknown[] };

/**
 * Resolves which bucket a storage key lives in by checking which table's row references it, using
 * the CALLER's own token so AppSync applies the caller's own permissions, not ours.
 * Returns null when no row the caller can see references the key — covers both "never existed" and
 * "exists but belongs to another tenant", so a guessed/leaked uuid can't be used to read or delete
 * someone else's file.
 */
export async function resolveStorageKeyBucket(token: string, key: string): Promise<string | null> {
  const data = await appsyncRequest<OwnershipData | null>(OWNERSHIP_QUERY, { key }, token).catch(() => null);
  if ((data?.property_files?.length ?? 0) > 0) return BUCKET;
  if ((data?.lease_files?.length ?? 0) > 0) return LEASE_BUCKET;
  return null;
}
