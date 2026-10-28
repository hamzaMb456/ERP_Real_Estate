// Public photo urls. Kept apart from public-api.ts (server only) so client components can build image urls too;
// public-api.ts re-exports it.

import { BUCKET } from '@/lib/storage-buckets';

const DEFAULT_STORAGE_URL = 'http://localhost:4566';

/**
 * A stored photo served from the Floci S3 bucket. The file is readable without a session.
 * Floci does not resize images, so `width` is not applied and the original file is served.
 */
export function publicImageUrl(fileId: string, _width: number): string {
  const base = process.env.NEXT_PUBLIC_STORAGE_URL ?? DEFAULT_STORAGE_URL;
  return `${base}/${BUCKET}/${encodeURIComponent(fileId)}`;
}
