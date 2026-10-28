import { getMessages } from '@/i18n/store';
import { downloadName } from '@/lib/files';
import { graphql } from '@/lib/graphql';
import { getSession } from '@/lib/auth/session';
import { BUCKET, LEASE_BUCKET } from '@/lib/storage-buckets';
import type { UploadDeps } from '@/lib/upload';

export { BUCKET, LEASE_BUCKET } from '@/lib/storage-buckets';

/** Uploads/downloads still require a signed-in user; reuse the same session token GraphQL calls use. */
function authHeader(): Record<string, string> {
  const token = getSession()?.accessToken;
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function storageFetch(path: string, init: RequestInit): Promise<Response> {
  const response = await fetch(`/api/storage/${path}`, {
    ...init,
    headers: { ...authHeader(), ...init.headers },
  });
  if (!response.ok) throw new Error(getMessages().common.uploadFailed);
  return response;
}

export async function uploadToBucket(file: File, bucket: string = BUCKET): Promise<string> {
  const form = new FormData();
  form.set('file', file);
  form.set('bucket', bucket);
  const response = await storageFetch('upload', { method: 'POST', body: form });
  const body = (await response.json()) as { id: string };
  return body.id;
}

export async function deleteStoredFile(id: string): Promise<void> {
  await storageFetch('delete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

export async function presignedUrl(id: string): Promise<string> {
  const response = await storageFetch('presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id }),
  });
  const body = (await response.json()) as { url: string };
  return body.url;
}

export async function downloadStoredFile(id: string, fileName: string): Promise<void> {
  const signedUrl = await presignedUrl(id);
  const fileResponse = await fetch(signedUrl);
  const blob = await fileResponse.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName(fileName, blob.type);
  link.click();
  // Revoke after the click has been handled, or some browsers cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const LINK_FILE = `
  mutation LinkFile($object: property_files_insert_input!) {
    insert_property_files_one(object: $object) { id }
  }
`;

export const storageDeps: UploadDeps = {
  upload: (file) => uploadToBucket(file),
  remove: deleteStoredFile,
  link: async (object) => {
    await graphql(LINK_FILE, { object });
  },
};

const LINK_LEASE_FILE = `
  mutation LinkLeaseFile($object: lease_files_insert_input!) {
    insert_lease_files_one(object: $object) { id }
  }
`;

export const leaseStorageDeps: UploadDeps = {
  upload: (file) => uploadToBucket(file, LEASE_BUCKET),
  remove: deleteStoredFile,
  link: async (object) => {
    await graphql(LINK_LEASE_FILE, { object });
  },
};
