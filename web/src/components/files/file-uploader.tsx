'use client';

import { useState } from 'react';
import { CheckCircle2, CircleAlert } from '@/components/icons';
import { toast } from 'sonner';
import { FileDrop } from '@/components/files/file-drop';
import { toUserMessage } from '@/lib/errors';
import { titleFromFileName, validateFile, type DocumentCategory, type FileKind } from '@/lib/files';
import { storageDeps } from '@/lib/storage';
import { uploadAndLink, type FileTarget } from '@/lib/upload';

import { useT } from '@/i18n/provider';
type Item = { key: string; name: string; status: 'waiting' | 'sending' | 'done' | 'error'; message?: string };

type Props = {
  target: FileTarget;
  kind: FileKind;
  category?: DocumentCategory;
  nextSortOrder: number;
  onUploaded: () => void;
};

export function FileUploader({ target, kind, category, nextSortOrder, onUploaded }: Props) {
  const t = useT();
  const [items, setItems] = useState<Item[]>([]);
  const busy = items.some((item) => item.status === 'waiting' || item.status === 'sending');
  const setStatus = (key: string, patch: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function handle(files: File[]) {
    const queue = files.map((file, index) => ({ file, key: `${Date.now()}-${index}-${file.name}`, error: validateFile(file, kind) }));
    setItems(queue.map((entry) => ({ key: entry.key, name: entry.file.name, status: entry.error ? 'error' : 'waiting', message: entry.error ?? undefined })));

    let order = nextSortOrder;
    let uploaded = 0;
    for (const entry of queue) {
      if (entry.error) continue;
      setStatus(entry.key, { status: 'sending' });
      try {
        await uploadAndLink(
          entry.file,
          target,
          { kind, category: category ?? null, title: titleFromFileName(entry.file.name), sortOrder: order },
          storageDeps,
        );
        order += 1;
        uploaded += 1;
        setStatus(entry.key, { status: 'done' });
      } catch (error) {
        setStatus(entry.key, { status: 'error', message: toUserMessage(error) });
      }
    }
    if (uploaded > 0) {
      toast.success(uploaded > 1 ? t.files.uploader.addedMany(uploaded) : t.files.uploader.addedOne);
      onUploaded();
    }
  }

  return (
    <div className="space-y-3">
      <FileDrop kind={kind} disabled={busy} onFiles={(files) => void handle(files)} />
      {items.length > 0 && (
        <ul className="space-y-2" aria-live="polite">
          {items.map((item) => (
            <li key={item.key} className="space-y-1 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{item.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  {item.status === 'waiting' && t.files.uploader.waiting}
                  {item.status === 'sending' && t.files.uploader.sending}
                  {item.status === 'done' && (
                    <>
                      <CheckCircle2 className="size-3.5 text-success" animation="draw" aria-hidden /> {t.files.uploader.done}
                    </>
                  )}
                  {item.status === 'error' && (
                    <>
                      <CircleAlert className="size-3.5 text-destructive" aria-hidden /> {t.files.uploader.failed}
                    </>
                  )}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={
                    item.status === 'done'
                      ? 'h-full w-full bg-success'
                      : item.status === 'sending'
                        ? 'h-full w-1/2 animate-pulse bg-primary'
                        : item.status === 'error'
                          ? 'h-full w-full bg-destructive'
                          : 'h-full w-0'
                  }
                />
              </div>
              {item.message && <p className="text-xs text-destructive">{item.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
