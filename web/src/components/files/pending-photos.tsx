'use client';

import { useEffect, useMemo } from 'react';
import { Trash2 } from '@/components/icons';
import { toast } from 'sonner';
import { FileDrop } from '@/components/files/file-drop';
import { Button } from '@/components/ui/button';
import { titleFromFileName, validateFile } from '@/lib/files';
import { storageDeps } from '@/lib/storage';
import { uploadAndLink, type FileTarget } from '@/lib/upload';

import { useT } from '@/i18n/provider';

/**
 * Photos picked before the record exists (new bien form): kept in memory with a preview, and uploaded by
 * `uploadPendingPhotos` once the bien has an id.
 */
export function PendingPhotos({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const t = useT();
  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function add(picked: File[]) {
    const accepted: File[] = [];
    for (const file of picked) {
      const problem = validateFile(file, 'photo');
      if (problem) toast.error(problem);
      else accepted.push(file);
    }
    if (accepted.length > 0) onChange([...files, ...accepted]);
  }

  return (
    <div className="space-y-3">
      <FileDrop kind="photo" onFiles={add} />
      {files.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.size}-${index}`} className="relative overflow-hidden rounded-lg border bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimizable */}
              <img src={previews[index]} alt={file.name} className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-center justify-between gap-1 border-t px-2 py-1">
                <span className="truncate text-xs">{file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t.properties.form.photosRemove(file.name)}
                  onClick={() => onChange(files.filter((_, position) => position !== index))}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Uploads the picked photos to the bien or unit, in order; returns how many failed (the bien itself is already saved). */
export async function uploadPendingPhotos(target: FileTarget, files: File[]): Promise<number> {
  let failed = 0;
  for (const [index, file] of files.entries()) {
    try {
      await uploadAndLink(file, target,{ kind: 'photo', category: null, title: titleFromFileName(file.name), sortOrder: index }, storageDeps);
    } catch {
      failed += 1;
    }
  }
  return failed;
}
