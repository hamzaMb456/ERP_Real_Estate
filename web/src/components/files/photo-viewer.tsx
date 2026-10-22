'use client';

import { ChevronLeft, ChevronRight, X } from '@/components/icons';
import { StorageImage } from '@/components/files/storage-image';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { useI18n, useT } from '@/i18n/provider';
type Photo = { id: string; storage_file_id: string; title: string };

const IMAGE_CLASS = 'max-h-[75vh] w-full rounded-md bg-black object-contain';

/**
 * Full-screen photo viewer. By default photos load through the authenticated Nhost client (ERP). The public site has
 * no session: it passes `imageSrc` (a plain url per file), and `closeLabel` to replace the English built-in close
 * button; `contentClassName` lets a portaled viewer carry the public theme (`site-root`).
 */
export function PhotoViewer({
  photos,
  index,
  onIndexChange,
  imageSrc,
  closeLabel,
  contentClassName,
}: {
  photos: Photo[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  imageSrc?: (fileId: string, width: number) => string;
  closeLabel?: string;
  contentClassName?: string;
}) {
  const t = useT();
  const { dir } = useI18n();
  const photo = index === null ? undefined : photos[index];
  const go = (step: number) => index !== null && onIndexChange((index + step + photos.length) % photos.length);

  return (
    <Dialog open={photo !== undefined} onOpenChange={(open) => !open && onIndexChange(null)}>
      <DialogContent
        className={cn('max-w-5xl gap-3 p-3 sm:max-w-5xl', contentClassName)}
        showCloseButton={closeLabel === undefined}
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
            {closeLabel !== undefined && (
              <DialogClose asChild>
                <Button variant="ghost" size="icon-sm" className="absolute top-2 end-2" aria-label={closeLabel}>
                  <X />
                </Button>
              </DialogClose>
            )}
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- the public photo url is already resized by Nhost storage
              <img src={imageSrc(photo.storage_file_id, 1600)} alt={photo.title} className={IMAGE_CLASS} />
            ) : (
              <StorageImage fileId={photo.storage_file_id} width={1600} alt={photo.title} className={IMAGE_CLASS} />
            )}
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
