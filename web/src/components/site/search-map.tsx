'use client';

import { ListingsMap, type ListingMapPoint } from '@/components/map';
import { MapPinOff } from '@/components/icons';
import { useT } from '@/i18n/provider';
import { formatNumber, formatTnd } from '@/lib/format';
import type { PublicListing } from '@/lib/site/listings-queries';

/** Listings that have coordinates become pins; the others are simply left off the map. */
export function toMapPoints(
  listings: PublicListing[],
  copy: { perMonth: string; linkLabel: string },
): ListingMapPoint[] {
  const points: ListingMapPoint[] = [];
  for (const listing of listings) {
    if (listing.latitude === null || listing.longitude === null) continue;
    points.push({
      id: listing.id,
      lat: listing.latitude,
      lon: listing.longitude,
      title: listing.title,
      short: formatNumber(listing.price, 0) + ' TND',
      city: listing.city,
      detail: listing.kind === 'rent' ? `${formatTnd(listing.price)} ${copy.perMonth}` : formatTnd(listing.price),
      href: `/logement/${listing.id}`,
      linkLabel: copy.linkLabel,
    });
  }
  return points;
}

/** « Carte » view: the listings of the current page on a map, or a short message when none can be placed. */
export function SearchMap({ listings, pricePins = true, className }: { listings: PublicListing[]; pricePins?: boolean; className?: string }) {
  const t = useT().site.search.map;
  const perMonth = useT().site.listingCard.perMonth;
  const points = toMapPoints(listings, { perMonth, linkLabel: t.open });

  if (points.length === 0) {
    return (
      <p className="flex items-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-card/60 px-6 py-10 text-sm text-muted-foreground">
        <MapPinOff className="size-5 shrink-0 text-primary" animation="none" />
        {t.empty}
      </p>
    );
  }
  return <ListingsMap points={points} label={t.label} pricePins={pricePins} className={className} />;
}
