'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { BedDouble, Building2, ChevronRight, Layers, Maximize2, MapPin, Sofa } from '@/components/icons';
import { useT } from '@/i18n/provider';
import { formatArea, formatNumber } from '@/lib/format';
import { formatDate } from '@/lib/ownership';
import type { PublicListing } from '@/lib/site/listings-queries';
import { SEARCH_PATH, searchHref } from '@/lib/site/search-links';
import { parseSearchParams } from '@/lib/site/search-params';
import { cn } from '@/lib/utils';
import { useAvailableFromFuture } from './listing-card';

export const CARD = 'rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8';

/** « Accueil › Louer › Carthage › titre »: the city is left out when the listing has none. */
export function ListingBreadcrumb({ listing }: { listing: PublicListing }) {
  const t = useT();
  const copy = t.site.listing.breadcrumb;
  const city = listing.city?.trim() || null;
  const modeLabel = listing.kind === 'rent' ? t.site.nav.rent : t.site.nav.buy;
  const separator = <ChevronRight size={14} className="shrink-0 text-muted-foreground/60 rtl:-scale-x-100" aria-hidden="true" />;
  const link = 'rounded-sm transition-colors hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none';
  const item = 'flex min-w-0 items-center gap-2';

  return (
    <nav aria-label={copy.label} className="mx-auto w-full max-w-7xl px-4 pt-6 pb-4 sm:px-6 lg:px-8">
      <ol className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-muted-foreground">
        <li>
          <Link href="/" className={link}>
            {copy.home}
          </Link>
        </li>
        <li className={item}>
          {separator}
          <Link href={SEARCH_PATH[listing.kind]} className={link}>
            {modeLabel}
          </Link>
        </li>
        {city ? (
          <li className={item}>
            {separator}
            <Link href={searchHref(listing.kind, parseSearchParams({ ville: city }))} className={link}>
              {city}
            </Link>
          </li>
        ) : null}
        <li className={cn(item, 'max-w-full')}>
          {separator}
          <span aria-current="page" className="block truncate font-semibold text-foreground">
            {listing.title}
          </span>
        </li>
      </ol>
    </nav>
  );
}

function Fact({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg bg-accent/60 p-3 text-center">
      <span className="text-primary" aria-hidden="true">
        {icon}
      </span>
      <span className="font-heading-site text-xs font-semibold [overflow-wrap:anywhere] text-foreground">{children}</span>
    </li>
  );
}

/** Status chip, title, place and the key facts (type, surface, rooms, floor, furnished). */
export function ListingHeader({ listing }: { listing: PublicListing }) {
  const t = useT();
  const copy = t.site.listingCard;
  const facts = t.site.listing.facts;
  const comesLater = useAvailableFromFuture(listing.availableFrom);

  const place = [listing.city, listing.governorate]
    .map((part) => part?.trim())
    .filter((part, index, parts): part is string => Boolean(part) && parts.indexOf(part) === index)
    .join(', ');
  const hasRooms = listing.rooms !== null && listing.rooms > 0;
  const isRent = listing.kind === 'rent';
  const showFurnished = isRent || listing.furnished;
  const typeLabel = t.labels.unitTypes[listing.unitType];

  return (
    <header className={CARD}>
      <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
        {comesLater && listing.availableFrom ? copy.availableFrom(formatDate(listing.availableFrom)) : copy.available}
      </p>
      <h1 className="font-heading-site mb-2 text-2xl leading-snug font-bold tracking-tight [overflow-wrap:anywhere] text-foreground md:text-3xl">
        {listing.title}
      </h1>
      {place ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <MapPin size={16} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="[overflow-wrap:anywhere]">{place}</span>
        </p>
      ) : null}

      <ul
        aria-label={facts.label}
        className={cn('mt-6 grid grid-cols-2 gap-2.5 border-t border-border pt-6 sm:grid-cols-3', showFurnished ? 'lg:grid-cols-5' : 'lg:grid-cols-4')}
      >
        {typeLabel ? <Fact icon={<Building2 size={20} />}>{typeLabel}</Fact> : null}
        {listing.surfaceM2 !== null ? <Fact icon={<Maximize2 size={20} />}>{formatArea(listing.surfaceM2)}</Fact> : null}
        {hasRooms ? <Fact icon={<BedDouble size={20} />}>{copy.rooms(listing.rooms as number)}</Fact> : null}
        {listing.floor !== null ? (
          <Fact icon={<Layers size={20} />}>{listing.floor === 0 ? copy.groundFloor : copy.floor(formatNumber(listing.floor, 0))}</Fact>
        ) : null}
        {showFurnished ? <Fact icon={<Sofa size={20} />}>{listing.furnished ? facts.furnished : facts.unfurnished}</Fact> : null}
      </ul>
    </header>
  );
}
