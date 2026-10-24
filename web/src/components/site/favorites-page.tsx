'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Heart } from '@/components/icons';
import { buttonVariants } from '@/components/ui/button-variants';
import { useT } from '@/i18n/provider';
import { useFavorites } from '@/lib/site/favorites';
import type { PublicListing } from '@/lib/site/listings-queries';
import { favoriteListingsAction } from '@/lib/site/request-actions';
import { cn } from '@/lib/utils';
import { ListingCard } from './listing-card';

type Loaded = { key: string; listings: PublicListing[] };

/** « Mes favoris »: the listings the visitor hearted on this device, read from the server by id. */
export function FavoritesPage() {
  const copy = useT().site.favourites;
  const { ids } = useFavorites();
  const key = ids.join(',');
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;
    let active = true;
    void favoriteListingsAction(ids)
      .then((listings) => active && setLoaded({ key, listings }))
      .catch(() => active && setLoaded({ key, listings: [] }));
    return () => {
      active = false;
    };
    // `ids` is fully described by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = ids.length > 0 && loaded?.key !== key;
  // Only the listings that are still hearted, in the order they were hearted.
  const shown = ids.length > 0 && loaded?.key === key ? loaded.listings.filter((listing) => ids.includes(listing.id)) : [];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading-site text-3xl font-bold text-foreground">{copy.title}</h1>
      <p className="mt-2 text-muted-foreground">{copy.subtitle}</p>

      {ids.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-card/60 px-6 py-14 text-center">
          <Heart className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">{copy.emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{copy.emptyBody}</p>
          <Link href="/louer" className={cn(buttonVariants({ size: 'lg' }), 'mt-2')}>
            {copy.browse}
          </Link>
        </div>
      ) : loading ? (
        <p role="status" className="mt-10 text-sm text-muted-foreground">
          {copy.loading}
        </p>
      ) : (
        <>
          <p className="mt-6 text-sm font-medium text-muted-foreground">{copy.count(shown.length)}</p>
          {shown.length < ids.length ? <p className="mt-1 text-xs text-muted-foreground">{copy.unavailable}</p> : null}
          <ul className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((listing) => (
              <li key={listing.id} className="min-w-0">
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
