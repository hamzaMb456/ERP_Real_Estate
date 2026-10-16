'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StorageImage } from '@/components/files/storage-image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

import { useI18n, useT } from '@/i18n/provider';
type Photo = { id: string; storage_file_id: string; title: string };

export function PhotoViewer({
  photos,
  index,
  onIndexChange,
}: {
  photos: Photo[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
}) {
  const t = useT();
  const { dir } = useI18n();
  const photo = index === null ? undefined : photos[index];
  const go = (step: number) => index !== null && onIndexChange((index + step + photos.length) % photos.length);

  return (
    <Dialog open={photo !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        className="max-w-5xl gap-3 p-3 sm:max-w-5xl"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') go(dir === 'rtl' ? -1 : 1);
          if (event.key === 'ArrowLeft') go(dir === 'rtl' ? 1 : -1);
        }}
      >
        {photo && index !== null && (
          <>
            <DialogTitle className="pe-8 text-base">{photo.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {t.files.photos.viewerCount(index + 1, photos.length)}
            </DialogDescription>
            <StorageImage fileId={photo.storage_file_id} width={1600} alt={photo.title} className="max-h-[75vh] w-full rounded-md bg-black object-contain" />
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={photos.length < 2}>
                <ChevronLeft data-icon="inline-start" className="rtl:-scale-x-100" />
                {t.files.photos.previous}
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {index + 1} / {photos.length}
              </span>
              <Button variant="outline" size="sm" onClick={() => go(1)} disabled={photos.length < 2}>
                {t.files.photos.next}
                <ChevronRight data-icon="inline-end" className="rtl:-scale-x-100" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
