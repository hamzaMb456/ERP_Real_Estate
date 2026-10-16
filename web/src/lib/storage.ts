import { getMessages } from '@/i18n/store';
import { downloadName } from '@/lib/files';
import { graphql } from '@/lib/graphql';
import { nhost } from '@/lib/nhost';
import type { UploadDeps } from '@/lib/upload';

export const BUCKET = 'property-files';

const LINK_FILE = `
  mutation LinkFile($object: property_files_insert_input!) {
    insert_property_files_one(object: $object) { id }
  }
`;

export async function uploadToBucket(file: File, bucket: string = BUCKET): Promise<string> {
  const response = await nhost.storage.uploadFiles({ 'bucket-id': bucket, 'file[]': [file] });
  const id = response.body.processedFiles[0]?.id;
  if (!id) throw new Error(getMessages().common.uploadFailed);
  return id;
}

export async function deleteStoredFile(id: string): Promise<void> {
  await nhost.storage.deleteFile(id);
}

export async function presignedUrl(id: string): Promise<string> {
  const response = await nhost.storage.getFilePresignedURL(id);
  return response.body.url;
}

/** Resized image as a local object URL (private files cannot be used directly in <img src>). */
export async function imageObjectUrl(id: string, width: number): Promise<string> {
  const response = await nhost.storage.getFile(id, { w: width, q: 80 });
  return URL.createObjectURL(response.body);
}

export async function downloadStoredFile(id: string, fileName: string): Promise<void> {
  const response = await nhost.storage.getFile(id);
  const url = URL.createObjectURL(response.body);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName(fileName, response.body.type);
  link.click();
  // Revoke after the click has been handled, or some browsers cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const storageDeps: UploadDeps = {
  upload: (file) => uploadToBucket(file),
  remove: deleteStoredFile,
  link: async (object) => {
    await graphql(LINK_FILE, { object });
  },
};

export const LEASE_BUCKET = 'lease-files';

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
