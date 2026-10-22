'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n/provider';
import type { SearchMode } from '@/lib/site/search-params';

const SKELETON_CARDS = 6;

/** Shown while the page reads its search parameters and the listings: the title right away, then grey placeholders. */
export function SearchSkeleton({ mode }: { mode: SearchMode }) {
  const t = useT().site.search;
  return (
    <div role="status" aria-label={t.loading}>
      <h1 className="mb-8 font-heading-site text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {mode === 'rent' ? t.rentTitle : t.saleTitle}
      </h1>
      <div className="grid gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
        <Skeleton className="hidden h-96 rounded-2xl lg:block" />
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <Skeleton key={index} className="h-80 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
