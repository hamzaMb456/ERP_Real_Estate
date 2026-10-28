'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CalendarClock } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button-variants';
import { useT } from '@/i18n/provider';
import { formatTnd } from '@/lib/format';
import { formatDate } from '@/lib/ownership';
import { graphql } from '@/lib/graphql';
import { useGraphql } from '@/lib/use-graphql';
import { accountHref, SIGN_IN_PATH } from '@/lib/site/account';
import { useClientSession } from '@/components/site/account-menu';
import { cn } from '@/lib/utils';
import { ScrollItem } from '@/components/motion/primitives';

const GET_VISITS = `query MyVisits { visit_requests(order_by: { created_at: desc }) { id unit_id visit_date visit_time status created_at } }`;
const GET_LISTINGS_FOR = `query ListingsFor($ids: [uuid!]) {
  public_listings(where: { unit_id: { _in: $ids } }) { unit_id title city visit_fee visit_payment_method visit_payment_instructions }
}`;

type VisitRow = { id: string; unit_id: string; visit_date: string; visit_time: string; status: string; created_at: string };
type ListingRow = {
  unit_id: string;
  title: string;
  city: string | null;
  visit_fee: number | null;
  visit_payment_method: string | null;
  visit_payment_instructions: string | null;
};

const NO_VISITS: VisitRow[] = [];

const TONE: Record<string, string> = {
  new: 'bg-warning/15 text-warning',
  confirmed: 'bg-success/10 text-success',
  declined: 'bg-destructive/10 text-destructive',
  done: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

/** « Mes visites »: the signed-in client's own visit requests, read server-side by client_user_id. */
export function MyVisitsPage() {
  const t = useT().site.myVisits;
  const { ready, signedIn } = useClientSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !signedIn) router.replace(accountHref(SIGN_IN_PATH, pathname));
  }, [ready, signedIn, router, pathname]);

  const visitsState = useGraphql<{ visit_requests: VisitRow[] }>(signedIn ? GET_VISITS : '');
  const visits = visitsState.status === 'success' ? visitsState.data.visit_requests : NO_VISITS;
  const unitIds = useMemo(() => [...new Set(visits.map((visit) => visit.unit_id))], [visits]);

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
  const loading = visitsState.status === 'loading';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-heading-site text-3xl font-bold text-foreground">{t.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.subtitle}</p>

      {loading ? (
        <p role="status" className="mt-10 text-sm text-muted-foreground">
          {t.loading}
        </p>
      ) : visits.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-card/60 px-6 py-14 text-center">
          <CalendarClock className="size-8 text-primary" aria-hidden="true" />
          <p className="font-semibold">{t.emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{t.emptyBody}</p>
          <Link href="/louer" className={cn(buttonVariants({ size: 'lg' }), 'mt-2')}>
            {t.browse}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-4">
          {visits.map((visit) => {
            const listing = listings[visit.unit_id];
            const showPayment = (visit.status === 'confirmed' || visit.status === 'declined') && listing?.visit_payment_method;
            const hasFee = listing?.visit_fee != null && listing.visit_fee > 0;
            return (
              <li key={visit.id}>
                <ScrollItem>
                  <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{listing?.title ?? t.listingFallback}</p>
                      <p className="text-sm text-muted-foreground">{t.when(formatDate(visit.visit_date), visit.visit_time.slice(0, 5))}</p>
                      {hasFee ? <p className="mt-1 text-xs text-muted-foreground">{t.fee(formatTnd(listing!.visit_fee))}</p> : null}
                      {showPayment ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {listing!.visit_payment_method === 'virtual'
                            ? `${t.payVirtualLabel} ${listing!.visit_payment_instructions}`
                            : t.payManual}
                        </p>
                      ) : null}
                    </div>
                    <Badge className={cn('h-6 px-2.5', TONE[visit.status] ?? TONE.done)}>{t.statuses[visit.status as keyof typeof t.statuses] ?? visit.status}</Badge>
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
