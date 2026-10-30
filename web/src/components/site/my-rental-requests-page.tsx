'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { FileText } from '@/components/icons';
import { ScrollItem } from '@/components/motion/primitives';
import { RequestProgress } from '@/components/requests/request-progress';
import { useClientSession } from '@/components/site/account-menu';
import { buttonVariants } from '@/components/ui/button-variants';
import { useT } from '@/i18n/provider';
import { graphql } from '@/lib/graphql';
import { formatDate } from '@/lib/ownership';
import { rentalProgress, type RentalStatus } from '@/lib/requests';
import { accountHref, SIGN_IN_PATH } from '@/lib/site/account';
import { useGraphql } from '@/lib/use-graphql';
import { cn } from '@/lib/utils';

const GET_REQUESTS = `query MyRentalRequests { rental_requests(order_by: { created_at: desc }) { id unit_id start_date duration_months status closed_outcome created_at } }`;
const GET_LISTINGS_FOR = `query ListingsFor($ids: [uuid!]) {
  public_listings(where: { unit_id: { _in: $ids } }) { unit_id title city }
}`;

type RequestRow = {
  id: string;
  unit_id: string;
  start_date: string;
  duration_months: number;
  status: RentalStatus;
  closed_outcome: string | null;
  created_at: string;
};
type ListingRow = { unit_id: string; title: string; city: string | null };

const NO_REQUESTS: RequestRow[] = [];

/** « Mes demandes »: the signed-in client's own rental requests, each with a three-state status bar. */
export function MyRentalRequestsPage() {
  const t = useT().site.myRentals;
  const { ready, signedIn } = useClientSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !signedIn) router.replace(accountHref(SIGN_IN_PATH, pathname));
  }, [ready, signedIn, router, pathname]);

  const requestsState = useGraphql<{ rental_requests: RequestRow[] }>(signedIn ? GET_REQUESTS : '');
  const requests = requestsState.status === 'success' ? requestsState.data.rental_requests : NO_REQUESTS;
  const unitIds = useMemo(() => [...new Set(requests.map((request) => request.unit_id))], [requests]);

  const [listings, setListings] = useState<Record<string, ListingRow>>({});
  useEffect(() => {
    if (unitIds.length === 0) return;
    let active = true;
    void graphql<{ public_listings: ListingRow[] }>(GET_LISTINGS_FOR, { ids: unitIds })
      .then((data) => {
        if (!active) return;
        setListings(Object.fromEntries(data.public_listings.map((listing) => [listing.unit_id, listing])));
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [unitIds]);

  if (!ready || !signedIn) return null;
  const loading = requestsState.status === 'loading';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading-site text-3xl font-bold text-foreground">{t.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

      {loading ? (
        <p role="status" className="mt-10 text-sm text-muted-foreground">
          {t.loading}
        </p>
      ) : requests.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-card/60 px-6 py-14 text-center">
          <FileText className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">{t.emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{t.emptyBody}</p>
          <Link href="/louer" className={cn(buttonVariants({ size: 'lg' }), 'mt-2')}>
            {t.browse}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {requests.map((request) => {
            const listing = listings[request.unit_id];
            return (
              <li key={request.id}>
                <ScrollItem>
                  <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{listing?.title ?? t.listingFallback}</p>
                      <p className="text-sm text-muted-foreground">{t.startsOn(formatDate(request.start_date), request.duration_months)}</p>
                    </div>
                    <RequestProgress outcome={rentalProgress(request.status, request.closed_outcome)} />
                  </div>
                </ScrollItem>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
