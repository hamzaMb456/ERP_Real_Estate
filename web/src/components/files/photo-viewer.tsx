'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StorageImage } from '@/components/files/storage-image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

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
  const photo = index === null ? undefined : photos[index];
  const go = (step: number) => index !== null && onIndexChange((index + step + photos.length) % photos.length);

  return (
    <Dialog open={photo !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        className="max-w-5xl gap-3 p-3 sm:max-w-5xl"
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') go(1);
          if (event.key === 'ArrowLeft') go(-1);
        }}
      >
        {photo && index !== null && (
          <>
            <DialogTitle className="pr-8 text-base">{photo.title}</DialogTitle>
            <DialogDescription className="sr-only">
              Photo {index + 1} sur {photos.length}. Flèches gauche et droite pour naviguer.
            </DialogDescription>
            <StorageImage fileId={photo.storage_file_id} width={1600} alt={photo.title} className="max-h-[75vh] w-full rounded-md bg-black object-contain" />
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => go(-1)} disabled={photos.length < 2}>
                <ChevronLeft data-icon="inline-start" />
                Précédente
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {index + 1} / {photos.length}
              </span>
              <Button variant="outline" size="sm" onClick={() => go(1)} disabled={photos.length < 2}>
                Suivante
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
