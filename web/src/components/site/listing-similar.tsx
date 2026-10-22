'use client';

import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { StaggerItem } from '@/components/motion/primitives';
import { useT } from '@/i18n/provider';
import type { PublicListing } from '@/lib/site/listings-queries';
import { SEARCH_PATH } from '@/lib/site/search-links';
import { ListingCard } from './listing-card';

/** « Biens similaires »: up to three cards close in place and price. Hidden when there are none. */
export function ListingSimilar({ listing, similar }: { listing: PublicListing; similar: PublicListing[] }) {
  const t = useT().site.listing.similar;
  if (similar.length === 0) return null;
  const city = listing.city?.trim();

  return (
    <section aria-labelledby="listing-similar-title" className="mt-14 border-t border-border pt-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="listing-similar-title" className="font-heading-site text-2xl font-bold tracking-tight text-foreground">
            {city ? t.titleInCity(city) : t.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <Link
          href={SEARCH_PATH[listing.kind]}
          className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
        >
          {t.all}
          <ArrowRight size={16} className="rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {similar.map((item) => (
          <li key={item.id}>
            <StaggerItem className="h-full">
              <ListingCard listing={item} />
            </StaggerItem>
          </li>
        ))}
      </ul>
    </section>
  );
}
