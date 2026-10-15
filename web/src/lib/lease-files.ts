import { titleFromFileName } from '@/lib/files';
import type { LeaseDocumentCategory } from '@/lib/leases';
import type { UploadDeps } from '@/lib/upload';

/** Stores the file, then links it to the lease; removes the stored file if the link fails. */
export async function uploadLeaseDocument(
  file: File,
  leaseId: string,
  category: LeaseDocumentCategory,
  deps: UploadDeps,
): Promise<void> {
  const storageFileId = await deps.upload(file);
  try {
    await deps.link({ lease_id: leaseId, storage_file_id: storageFileId, category, title: titleFromFileName(file.name) });
  } catch (error) {
    await deps.remove(storageFileId).catch(() => undefined);
    throw error;
  }
}
