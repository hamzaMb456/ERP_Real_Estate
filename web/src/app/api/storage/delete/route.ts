import { NextResponse } from 'next/server';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { requireSession, requireWriter, type SessionClaims } from '@/lib/server/auth';
import { resolveStorageKeyBucket } from '@/lib/server/file-ownership';
import { forgetStorageFile } from '@/lib/server/storage-registry';
import { s3 } from '@/lib/server/s3-client';
import { isStorageKey } from '@/lib/storage-buckets';
import { WRITE_FROZEN, writesFrozen } from '@/lib/write-freeze';

export async function POST(request: Request): Promise<Response> {
  if (writesFrozen()) return NextResponse.json({ error: WRITE_FROZEN }, { status: 503 });
  let session: SessionClaims;
  try {
    session = await requireSession(request.headers.get('authorization'));
    requireWriter(session);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const key = payload?.id;
  if (typeof key !== 'string' || !isStorageKey(key)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // Writer role alone doesn't scope to *which* file — confirm the caller's own Hasura
  // permissions can see a record referencing this key before deleting it from S3.
  const bucket = await resolveStorageKeyBucket(session.token, key);
  if (!bucket) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  } catch (error) {
    console.error('[storage/delete] s3 delete failed', error);
    return NextResponse.json({ error: 'delete_failed' }, { status: 502 });
  }

  // Best-effort: `key` is already uuid-validated above, so it is safe to pass on.
  // Not fatal if it fails — the S3 object is already gone, this just avoids an orphaned tracking row.
  await forgetStorageFile(session.token, key).catch((error: unknown) => {
    console.error('[storage/delete] app_storage_files cleanup failed', error);
  });

  return NextResponse.json({ ok: true });
}
