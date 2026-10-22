'use client';

import Link from 'next/link';
import { useState, useSyncExternalStore } from 'react';
import { BedDouble, Heart, ImageOff, Layers, MapPin, Maximize2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useT } from '@/i18n/provider';
import { todayTunis } from '@/lib/dates';
import { formatArea, formatNumber, formatTnd } from '@/lib/format';
import { formatDate } from '@/lib/ownership';
import { publicImageUrl } from '@/lib/site/image-url';
import type { PublicListing } from '@/lib/site/listings-queries';

const COVER_WIDTH = 640;

const subscribeNever = () => () => {};
const serverToday = (): string | null => null;

/** True while the availability date is still ahead. Without a date the listing is available now. */
function useAvailableFromFuture(availableFrom: string | null): boolean {
  // The current day comes from the client snapshot only: the server snapshot is null, so the clock is never read
  // while the card is prerendered. Until the client knows the day, a dated listing shows « Dès le <date> »,
  // which is true whether that date is past or not.
  const today = useSyncExternalStore(subscribeNever, todayTunis, serverToday);
  if (!availableFrom) return false;
  return today === null || availableFrom > today;
}

function Spec({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-primary" aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{children}</span>
    </li>
  );
}

/**
 * A listing in a grid: cover photo, availability chip, price, title, city and key figures.
 * The whole card is one link (the title link is stretched over it); the favourite heart is not live yet.
 * Rendered inside `.site-root`; the parent decides how cards are revealed (StaggerItem), the card adds no motion.
 */
export function ListingCard({ listing }: { listing: PublicListing }) {
  const t = useT();
  const copy = t.site.listingCard;
  const [failedFileId, setFailedFileId] = useState<string | null>(null);
  const comesLater = useAvailableFromFuture(listing.availableFrom);

  const showPhoto = listing.coverFileId !== null && failedFileId !== listing.coverFileId;
  const isRent = listing.kind === 'rent';
  const hasRooms = listing.rooms !== null && listing.rooms > 0;
  const hasSpecs = listing.surfaceM2 !== null || hasRooms || listing.floor !== null;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm transition-shadow duration-200 hover:shadow-lg motion-reduce:transition-none">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {showPhoto && listing.coverFileId ? (
          // A plain <img>: photos come from Nhost Storage under a per-project subdomain and are already resized by its image transform.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicImageUrl(listing.coverFileId, COVER_WIDTH)}
            alt={copy.photoAlt(listing.title)}
            loading="lazy"
            decoding="async"
            onError={() => setFailedFileId(listing.coverFileId)}
            className="size-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-105"
          />
        ) : (
          <div role="img" aria-label={copy.noPhoto} className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff size={40} strokeWidth={1.5} aria-hidden="true" />
          </div>
        )}

        <span className="absolute start-3 top-3 inline-flex items-center rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-sm">
          {comesLater && listing.availableFrom ? copy.availableFrom(formatDate(listing.availableFrom)) : copy.available}
        </span>

        {/* A disabled button fires no pointer events: the tooltip hangs on the wrapper. */}
        <span className="absolute end-3 top-3 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex rounded-full" tabIndex={0}>
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  disabled
                  aria-label={copy.favourite}
                  className="rounded-full bg-card/90 text-foreground shadow-sm"
                >
                  <Heart aria-hidden="true" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{copy.soon}</TooltipContent>
          </Tooltip>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span data-testid="listing-price" dir="ltr" className="text-xl font-semibold whitespace-nowrap text-primary tabular-nums">
            {formatTnd(listing.price)}
          </span>
          {isRent ? <span className="text-sm text-muted-foreground">{copy.perMonth}</span> : null}
        </p>

        <h3 className="font-heading-site line-clamp-2 text-base leading-snug font-semibold [overflow-wrap:anywhere]">
          <Link
            href={`/logement/${listing.id}`}
            className="rounded-sm outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-3 focus-visible:after:ring-ring/60"
          >
            {listing.title}
          </Link>
        </h3>

        {listing.city ? (
          <p data-testid="listing-city" className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin size={16} className="shrink-0 text-primary" aria-hidden="true" />
            <span className="truncate">{listing.city}</span>
          </p>
        ) : null}

        {hasSpecs ? (
          <ul
            data-testid="listing-specs"
            className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-sm text-muted-foreground"
          >
            {listing.surfaceM2 !== null ? <Spec icon={<Maximize2 size={16} />}>{formatArea(listing.surfaceM2)}</Spec> : null}
            {hasRooms ? <Spec icon={<BedDouble size={16} />}>{copy.rooms(listing.rooms as number)}</Spec> : null}
            {listing.floor !== null ? (
              <Spec icon={<Layers size={16} />}>{listing.floor === 0 ? copy.groundFloor : copy.floor(formatNumber(listing.floor, 0))}</Spec>
            ) : null}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
