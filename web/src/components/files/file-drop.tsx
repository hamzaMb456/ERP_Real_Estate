'use client';

import { useId, useState } from 'react';
import { Upload } from '@/components/icons';
import { ACCEPT_ATTR, formatsLabel, type FileKind } from '@/lib/files';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';
export function FileDrop({ kind, disabled = false, onFiles }: { kind: FileKind; disabled?: boolean; onFiles: (files: File[]) => void }) {
  const t = useT();
  const [over, setOver] = useState(false);
  const inputId = useId();

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
      className={cn(
        // `relative` anchors the visually hidden (absolute) input to this label. Without it the input's containing block is
        // the app shell, which is overflow-hidden: opening the file dialog focuses the input, the browser scrolls the shell
        // to reveal it and the whole page content slides up, leaving a blank band.
        'relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
        over ? 'border-primary bg-accent/50' : 'hover:bg-muted/50',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <Upload className="size-6 text-muted-foreground" aria-hidden />
      <span className="font-medium">{t.files.drop.title}</span>
      <span className="text-xs text-muted-foreground">{t.files.drop.limit(formatsLabel(kind))}</span>
      <input
        id={inputId}
        type="file"
        multiple
        accept={ACCEPT_ATTR[kind]}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) onFiles(files);
        }}
      />
    </label>
  );
}
