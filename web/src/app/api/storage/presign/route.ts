import { NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireSession, type SessionClaims } from '@/lib/server/auth';
import { resolveStorageKeyBucket } from '@/lib/server/file-ownership';
import { s3Public } from '@/lib/server/s3-client';
import { isStorageKey } from '@/lib/storage-buckets';

const EXPIRES_SECONDS = 300;

export async function POST(request: Request): Promise<Response> {
  let session: SessionClaims;
  try {
    // Reading a file only needs a valid session, not the writer role (any signed-in user may fetch a file).
    session = await requireSession(request.headers.get('authorization'));
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const key = payload?.id;
  if (typeof key !== 'string' || !isStorageKey(key)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  // The key itself isn't a secrecy boundary — any signed-in user could guess or reuse a uuid.
  // Only presign a file the caller's own data-layer permissions let them see.
  const bucket = await resolveStorageKeyBucket(session.token, key);
  if (!bucket) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const url = await getSignedUrl(s3Public, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: EXPIRES_SECONDS });
    return NextResponse.json({ url });
  } catch (error) {
    console.error('[storage/presign] s3 presign failed', error);
    return NextResponse.json({ error: 'presign_failed' }, { status: 502 });
  }
}
