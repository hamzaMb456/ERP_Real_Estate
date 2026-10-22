'use client';

import { useState } from 'react';
import { Camera, ExternalLink, ImageOff } from '@/components/icons';
import { PhotoViewer } from '@/components/files/photo-viewer';
import { useT } from '@/i18n/provider';
import { safeTourUrl } from '@/lib/site/listing-links';
import { publicImageUrl } from '@/lib/site/image-url';
import type { PublicListing } from '@/lib/site/listings-queries';
import { cn } from '@/lib/utils';

const MAIN_WIDTH = 1200;
const THUMB_WIDTH = 600;
const MAX_THUMBS = 4;

const FRAME = 'relative overflow-hidden rounded-xl bg-muted';
const OVERLAY_BUTTON =
  'inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card/90 px-4 text-sm font-semibold text-foreground shadow-md backdrop-blur-md transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none';

/** Photos in display order; a listing opened without its photo list still shows its cover. */
function photoIds(listing: PublicListing): string[] {
  if (listing.photos && listing.photos.length > 0) {
    return [...listing.photos].sort((a, b) => a.position - b.position).map((photo) => photo.storageFileId);
  }
  return listing.coverFileId ? [listing.coverFileId] : [];
}

/** How many of the 2x2 cells each thumbnail covers, so that 1 to 4 thumbnails always fill the block. */
function thumbSpan(count: number, index: number): string {
  if (count === 1) return 'col-span-2 row-span-2';
  if (count === 2) return 'col-span-1 row-span-2';
  if (count === 3 && index === 2) return 'col-span-2';
  return '';
}

/** One clickable photo of the grid. A photo that fails to load is replaced by the placeholder icon. */
function GalleryPhoto({
  id,
  label,
  width,
  eager,
  failed,
  onOpen,
  onError,
}: {
  id: string;
  label: string;
  width: number;
  eager: boolean;
  failed: boolean;
  onOpen: () => void;
  onError: () => void;
}) {
  const noPhoto = useT().site.listingCard.noPhoto;
  if (failed) {
    return (
      <div role="img" aria-label={noPhoto} className="flex size-full items-center justify-center text-muted-foreground">
        <ImageOff size={32} strokeWidth={1.5} aria-hidden="true" />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="group block size-full cursor-zoom-in outline-none focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:ring-inset"
    >
      {/* A plain <img>: photos come from Nhost Storage (per-project subdomain) and are already resized by its image transform. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={publicImageUrl(id, width)}
        alt=""
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={onError}
        className="size-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
      />
    </button>
  );
}

/**
 * Photo block of the unit page: one large photo and up to four thumbnails (hidden on phones), « Voir les N photos »
 * (full-screen viewer) and, when the listing has a valid tour link, « Visite virtuelle ». Without photo a placeholder
 * is shown and there is no viewer button.
 */
export function ListingGallery({ listing }: { listing: PublicListing }) {
  const t = useT().site.listing.gallery;
  const noPhoto = useT().site.listingCard.noPhoto;
  const [viewer, setViewer] = useState<number | null>(null);
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const ids = photoIds(listing);
  const tour = safeTourUrl(listing.virtualTourUrl);
  const thumbs = ids.slice(1, 1 + MAX_THUMBS);
  const hasThumbs = thumbs.length > 0;
  const altOf = (index: number) => t.open(index + 1, ids.length);

  const markFailed = (id: string) => setFailed((previous) => new Set(previous).add(id));
  const photo = (index: number, width: number, eager = false) => (
    <GalleryPhoto
      id={ids[index]}
      label={altOf(index)}
      width={width}
      eager={eager}
      failed={failed.has(ids[index])}
      onOpen={() => setViewer(index)}
      onError={() => markFailed(ids[index])}
    />
  );

  return (
    <section aria-label={t.label} className="relative mb-8">
      {ids.length === 0 ? (
        <div
          role="img"
          aria-label={noPhoto}
          className={cn(FRAME, 'flex h-64 items-center justify-center text-muted-foreground sm:h-80 md:h-[30rem]')}
        >
          <ImageOff size={56} strokeWidth={1.25} aria-hidden="true" />
        </div>
      ) : (
        <div className={cn('grid gap-3 md:h-[30rem]', hasThumbs ? 'md:grid-cols-12' : '')}>
          <div className={cn(FRAME, 'aspect-[4/3] md:aspect-auto md:h-full', hasThumbs ? 'md:col-span-7' : '')}>
            {photo(0, MAIN_WIDTH, true)}
          </div>
          {hasThumbs ? (
            <div className="hidden h-full grid-cols-2 grid-rows-2 gap-3 md:col-span-5 md:grid">
              {thumbs.map((id, position) => (
                <div key={`${position}-${id}`} className={cn(FRAME, thumbSpan(thumbs.length, position))}>
                  {photo(position + 1, THUMB_WIDTH)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {ids.length > 0 || tour ? (
        <div className="absolute end-3 bottom-3 z-10 flex flex-wrap items-center justify-end gap-2 sm:end-4 sm:bottom-4">
          {ids.length > 0 ? (
            <button type="button" onClick={() => setViewer(0)} className={OVERLAY_BUTTON}>
              <Camera size={18} aria-hidden="true" />
              {t.viewAll(ids.length)}
            </button>
          ) : null}
          {tour ? (
            <a href={tour} target="_blank" rel="noopener noreferrer" className={cn(OVERLAY_BUTTON, 'text-primary')}>
              <ExternalLink size={18} aria-hidden="true" />
              {t.tour}
              <span className="sr-only"> {t.tourHint}</span>
            </a>
          ) : null}
        </div>
      ) : null}

      <PhotoViewer
        photos={ids.map((id, index) => ({ id, storage_file_id: id, title: altOf(index) }))}
        index={viewer}
        onIndexChange={setViewer}
        imageSrc={publicImageUrl}
        closeLabel={t.close}
        contentClassName="site-root"
      />
    </section>
  );
}
