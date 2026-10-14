'use client';

import { useId, useState } from 'react';
import { Upload } from 'lucide-react';
import { ACCEPT_ATTR, formatsLabel, type FileKind } from '@/lib/files';
import { cn } from '@/lib/utils';

export function FileDrop({ kind, disabled = false, onFiles }: { kind: FileKind; disabled?: boolean; onFiles: (files: File[]) => void }) {
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
        'flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
        over ? 'border-primary bg-accent/50' : 'hover:bg-muted/50',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <Upload className="size-6 text-muted-foreground" aria-hidden />
      <span className="font-medium">Déposez vos fichiers ici ou cliquez pour choisir</span>
      <span className="text-xs text-muted-foreground">{formatsLabel(kind)} · 10 Mo maximum par fichier</span>
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
