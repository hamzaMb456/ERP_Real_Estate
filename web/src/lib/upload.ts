import type { DocumentCategory, FileKind } from '@/lib/files';

export type FileTarget = { propertyId: string } | { unitId: string };

export type UploadDeps = {
  upload: (file: File) => Promise<string>;
  remove: (storageFileId: string) => Promise<void>;
  link: (object: Record<string, unknown>) => Promise<void>;
};

export type UploadMeta = { kind: FileKind; category: DocumentCategory | null; title: string; sortOrder: number };

const targetColumns = (target: FileTarget) =>
  'propertyId' in target ? { property_id: target.propertyId } : { unit_id: target.unitId };

export function fileTargetWhere(target: FileTarget, kind: FileKind): Record<string, unknown> {
  const columns = targetColumns(target);
  return {
    kind: { _eq: kind },
    ...Object.fromEntries(Object.entries(columns).map(([column, value]) => [column, { _eq: value }])),
  };
}

/** Stores the file, then links it to the bien or unit; removes the stored file if the link fails. */
export async function uploadAndLink(file: File, target: FileTarget, meta: UploadMeta, deps: UploadDeps): Promise<void> {
  const storageFileId = await deps.upload(file);
  try {
    await deps.link({
      ...targetColumns(target),
      storage_file_id: storageFileId,
      kind: meta.kind,
      category: meta.kind === 'document' ? (meta.category ?? 'other') : null,
      title: meta.title,
      sort_order: meta.sortOrder,
    });
  } catch (error) {
    await deps.remove(storageFileId).catch(() => undefined);
    throw error;
  }
}
