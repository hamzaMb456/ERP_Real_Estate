'use client';

import { Clock, Mail, Phone } from '@/components/icons';
import { useT } from '@/i18n/provider';
import { formatTnd } from '@/lib/format';
import { siteConfig } from '@/lib/site/config';
import { mailtoHref, telHref } from '@/lib/site/listing-links';
import type { PublicListing } from '@/lib/site/listings-queries';

const CONTACT_LINK =
  'flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none';

/**
 * Sticky card of the unit page: the price, the agency's phone and e-mail, and a notice that online applications
 * and offers are coming. Slices 2 (rent application) and 3 (sale offer) replace the notice with their buttons.
 */
export function ListingContactCard({ listing }: { listing: PublicListing }) {
  const t = useT().site;
  const copy = t.listing.contact;
  const isRent = listing.kind === 'rent';

  return (
    <aside
      aria-labelledby="listing-contact-title"
      className="self-start rounded-xl border border-primary/20 bg-card p-6 shadow-xl shadow-primary/10 lg:sticky lg:top-24"
    >
      <div className="border-b border-border pb-5">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span
            data-testid="listing-price"
            dir="ltr"
            className="font-heading-site text-3xl font-extrabold whitespace-nowrap text-primary tabular-nums"
          >
            {formatTnd(listing.price)}
          </span>
          {isRent ? <span className="text-sm font-medium text-muted-foreground">{t.listingCard.perMonth}</span> : null}
        </p>
        {isRent && listing.charges !== null && listing.charges > 0 ? (
          <p dir="ltr" className="mt-1 text-xs font-medium text-muted-foreground">
            {copy.chargesExtra(formatTnd(listing.charges))}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 py-5">
        <h2 id="listing-contact-title" className="font-heading-site text-base font-bold text-foreground">
          {copy.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.intro}</p>
        <a href={telHref(siteConfig.phone)} className={CONTACT_LINK}>
          <Phone size={18} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="sr-only">{copy.phone} : </span>
          <span dir="ltr" className="tabular-nums">
            {siteConfig.phone}
          </span>
        </a>
        <a href={mailtoHref(siteConfig.email)} className={CONTACT_LINK}>
          <Mail size={18} className="shrink-0 text-primary" aria-hidden="true" />
          <span className="sr-only">{copy.email} : </span>
          <span dir="ltr" className="truncate">
            {siteConfig.email}
          </span>
        </a>
      </div>

      <p className="flex items-start gap-2.5 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-accent-foreground">
        <Clock size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        {copy.soon}
      </p>
    </aside>
  );
}
