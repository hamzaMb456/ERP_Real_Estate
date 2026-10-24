// Shared between client (web/src/lib/storage.ts) and server (web/src/app/api/storage/*) code,
// so it carries no 'server-only' tag — just string constants, nothing secret.

export const BUCKET = 'property-files';
export const LEASE_BUCKET = 'lease-files';

export const ALLOWED_BUCKETS = new Set([BUCKET, LEASE_BUCKET]);

// property_files.storage_file_id / lease_files.storage_file_id are `uuid` columns in Postgres, so
// the id storage.ts passes around must be a bare uuid — no "<bucket>/<key>" prefix. Which bucket a
// key lives in is instead resolved by checking which table's row references it (see
// web/src/lib/server/file-ownership.ts), which doubles as the per-file authorization check.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isStorageKey(id: string): boolean {
  return UUID_RE.test(id);
}
