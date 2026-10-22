'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/i18n/provider';

/** Shown while the listing is read: grey blocks where the gallery, the header and the contact card will be. */
export function ListingSkeleton() {
  const t = useT().site.listing;
  return (
    <div role="status" aria-label={t.loading} className="mx-auto w-full max-w-7xl px-4 pt-6 pb-20 sm:px-6 lg:px-8">
      <Skeleton className="mb-4 h-5 w-64 max-w-full" />
      <Skeleton className="mb-8 h-64 rounded-xl sm:h-80 md:h-[30rem]" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-8">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="hidden h-96 rounded-xl lg:col-span-4 lg:block" />
      </div>
    </div>
  );
}
