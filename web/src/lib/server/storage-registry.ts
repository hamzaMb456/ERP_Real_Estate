import 'server-only';

import { appsyncRequest, dataBackend } from '@/lib/backend';
import { hasuraRunSql } from '@/lib/server/hasura-admin';

// Which user uploaded which S3 object, and into which bucket: what the file-link checks rely on.
// Hasura: raw SQL with the admin secret (values are uuid/bucket-validated by the routes).
// AppSync: the caller's own token; the API records the caller as the uploader.

const REGISTER = 'mutation RegisterStorageFile($key: uuid!, $bucket: String!) { insert_app_storage_files_one { id } }';
const FORGET = 'mutation ForgetStorageFile($key: uuid!) { delete_app_storage_files_by_pk { id } }';

export async function registerStorageFile(token: string, key: string, bucket: string, userId: string): Promise<void> {
  if (dataBackend() === 'appsync') {
    await appsyncRequest(REGISTER, { key, bucket }, token);
    return;
  }
  await hasuraRunSql(`insert into public.app_storage_files (id, bucket, uploaded_by_user_id) values ('${key}', '${bucket}', '${userId}')`);
}

export async function forgetStorageFile(token: string, key: string): Promise<void> {
  if (dataBackend() === 'appsync') {
    await appsyncRequest(FORGET, { key }, token);
    return;
  }
  await hasuraRunSql(`delete from public.app_storage_files where id = '${key}'`);
}
