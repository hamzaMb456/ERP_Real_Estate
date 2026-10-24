import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireSession, requireWriter, type SessionClaims } from '@/lib/server/auth';
import { registerStorageFile } from '@/lib/server/storage-registry';
import { s3 } from '@/lib/server/s3-client';
import { ALLOWED_BUCKETS, isStorageKey } from '@/lib/storage-buckets';

export async function POST(request: Request): Promise<Response> {
  let session: SessionClaims;
  try {
    session = await requireSession(request.headers.get('authorization'));
    requireWriter(session);
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // JWTs are only type-checked as strings by the verifier, not shape-checked — `sub` could in
  // principle be any string. Confirm it is a uuid before it ever reaches raw SQL (see hasuraRunSql).
  if (!isStorageKey(session.userId)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');
  const bucket = form.get('bucket');
  if (!(file instanceof File) || typeof bucket !== 'string' || !ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const key = randomUUID();
  const body = Buffer.from(await file.arrayBuffer());
  try {
    await s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: file.type || 'application/octet-stream' }),
    );
  } catch (error) {
    console.error('[storage/upload] s3 put failed', error);
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }

  // property_files_check_storage / lease_files_check_storage (db/migrations/0013) require a
  // matching row here before storage_file_id can be linked to a record — without this the upload
  // succeeds but every later link attempt fails. Values are safe to inline: `key` just came from
  // randomUUID(), `bucket` is one of the two ALLOWED_BUCKETS literals, `userId` was regex-checked above.
  try {
    await registerStorageFile(session.token, key, bucket, session.userId);
  } catch (error) {
    console.error('[storage/upload] app_storage_files insert failed', error);
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch(() => undefined);
    return NextResponse.json({ error: 'upload_failed' }, { status: 502 });
  }

  // Bare uuid — property_files.storage_file_id / lease_files.storage_file_id are `uuid` columns.
  return NextResponse.json({ id: key });
}
