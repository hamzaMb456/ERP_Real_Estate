'use client';

import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n/provider';
import { MAX_NAME_LENGTH, type SavedPalette } from '@/theme/storage';
import { previewSelection, removePalette, savePalette } from '@/theme/store';
import type { Selection } from '@/theme/palettes';
import { PaletteSwatch } from './palette-swatch';

type Props = { saved: SavedPalette[]; current: Selection; mode: 'light' | 'dark' };

/** Named copies of a palette plus colour overrides, kept in the user preferences. */
export function SavedPalettes({ saved, current, mode }: Props) {
  const t = useT().appearance.saved;
  const [name, setName] = useState('');

  function handleSave(event: FormEvent) {
    event.preventDefault();
    const entry = savePalette(name, current);
    if (!entry) return;
    toast.success(t.savedToast(entry.name));
    setName('');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.heading}</CardTitle>
        <CardDescription>{t.hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1 space-y-1.5">
            <Label htmlFor="saved-palette-name">{t.nameLabel}</Label>
            <Input
              id="saved-palette-name"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              placeholder={t.namePlaceholder}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" disabled={!name.trim()}>
            {t.save}
          </Button>
        </form>

        {saved.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.empty}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {saved.map((entry) => (
              <li key={entry.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border p-2.5">
                <div className="w-24 shrink-0">
                  <PaletteSwatch selection={entry} mode={mode} />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{entry.name}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => previewSelection(entry)}>
                  {t.use}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t.remove(entry.name)}
                  onClick={() => {
                    removePalette(entry.id);
                    toast.success(t.removedToast(entry.name));
                  }}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
