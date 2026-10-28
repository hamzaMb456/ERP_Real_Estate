import 'server-only';

import { appsyncRequest } from '@/lib/backend';

// The API records the caller as the uploader, so the caller's token is all that is needed here.

const REGISTER = 'mutation RegisterStorageFile($key: uuid!, $bucket: String!) { insert_app_storage_files_one { id } }';
const FORGET = 'mutation ForgetStorageFile($key: uuid!) { delete_app_storage_files_by_pk { id } }';

export async function registerStorageFile(token: string, key: string, bucket: string): Promise<void> {
  await appsyncRequest(REGISTER, { key, bucket }, token);
}

export async function forgetStorageFile(token: string, key: string): Promise<void> {
  await appsyncRequest(FORGET, { key }, token);
}
