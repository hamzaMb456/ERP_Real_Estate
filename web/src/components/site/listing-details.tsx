'use client';

import { useId, type ReactNode } from 'react';
import { Check, FileText, IdCard, ShieldCheck, type LucideIcon } from '@/components/icons';
import { ListingsMap } from '@/components/map';
import { useT } from '@/i18n/provider';
import { formatTnd } from '@/lib/format';
import { formatDate } from '@/lib/ownership';
import type { PublicListing } from '@/lib/site/listings-queries';
import { cn } from '@/lib/utils';
import { CARD } from './listing-header';

const COORDINATE_DECIMALS = 1000;

/** The exact address is not public: the pin sits at coordinates rounded to 3 decimals (about 100 m). */
const roundCoordinate = (value: number) => Math.round(value * COORDINATE_DECIMALS) / COORDINATE_DECIMALS;

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn(CARD, className)}>
      <h2 id={id} className="font-heading-site mb-5 text-xl font-bold text-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Free text of the agency, shown as plain text (React escapes it) with its line breaks kept. */
export function ListingDescription({ listing }: { listing: PublicListing }) {
  const t = useT().site.listing;
  const text = listing.description?.trim();
  if (!text) return null;
  return (
    <Section title={t.description}>
      <p className="text-base leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] text-muted-foreground">{text}</p>
    </Section>
  );
}

export function ListingAmenities({ listing }: { listing: PublicListing }) {
  const t = useT();
  const labels = t.listings.amenities as Record<string, string>;
  // Only the catalog's amenities are shown, each once: a value the database does not know is not displayed.
  const known = [...new Set(listing.amenities)].filter((key) => key in labels);
  if (known.length === 0) return null;
  return (
    <Section title={t.site.listing.amenities}>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {known.map((key) => (
          <li key={key} className="flex items-center gap-3">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary" aria-hidden="true">
              <Check size={14} strokeWidth={3} />
            </span>
            <span className="text-sm font-medium text-foreground">{labels[key]}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** « Emplacement »: the map with one pin, only when the listing has coordinates. */
export function ListingLocation({ listing }: { listing: PublicListing }) {
  const t = useT();
  const copy = t.site.listing.location;
  if (listing.latitude === null || listing.longitude === null) return null;
  const point = {
    id: listing.id,
    lat: roundCoordinate(listing.latitude),
    lon: roundCoordinate(listing.longitude),
    title: listing.title,
    city: listing.city,
    detail: listing.kind === 'rent' ? `${formatTnd(listing.price)} ${t.site.listingCard.perMonth}` : formatTnd(listing.price),
  };
  return (
    <Section title={copy.title}>
      {/* The map loader shows a tall skeleton: this frame keeps the section's height steady while it loads. */}
      <div className="h-64 overflow-hidden rounded-xl sm:h-72">
        <ListingsMap points={[point]} label={copy.mapLabel} className="h-full" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{copy.approximate}</p>
    </Section>
  );
}

function Term({
  label,
  value,
  hint,
  strong,
  amount,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  strong?: boolean;
  /** An amount in TND: always read left to right, whatever the language. */
  amount?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-accent/40 p-4">
      <dt className="mb-1 text-xs font-medium text-muted-foreground">{label}</dt>
      <dd>
        <span
          dir={amount ? 'ltr' : undefined}
          className={cn('font-heading-site block text-lg font-bold tabular-nums [overflow-wrap:anywhere]', strong ? 'text-primary' : 'text-foreground')}
        >
          {value}
        </span>
        {hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  );
}

/** Rent: rent, charges, deposit, availability. Sale: price, reservation deposit and its duration. */
export function ListingConditions({ listing }: { listing: PublicListing }) {
  const t = useT().site.listing.conditions;
  const perMonth = useT().site.listingCard.perMonth;
  const isRent = listing.kind === 'rent';

  if (!isRent) {
    return (
      <Section title={t.saleTitle}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <Term label={t.price} value={formatTnd(listing.price)} amount strong />
          {listing.reservationDeposit > 0 ? <Term label={t.reservationDeposit} value={formatTnd(listing.reservationDeposit)} amount /> : null}
          {listing.reservationDays > 0 ? <Term label={t.reservationDays} value={t.days(listing.reservationDays)} /> : null}
        </dl>
      </Section>
    );
  }

  return (
    <Section title={t.rentTitle}>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Term label={t.rent} value={formatTnd(listing.price)} hint={perMonth} amount strong />
        {listing.charges !== null ? <Term label={t.charges} value={formatTnd(listing.charges)} hint={perMonth} amount /> : null}
        {listing.depositMonths > 0 ? (
          <Term
            label={t.deposit}
            value={t.depositMonths(listing.depositMonths)}
            hint={<bdi dir="ltr">{`(${formatTnd(listing.depositMonths * listing.price)})`}</bdi>}
          />
        ) : null}
        <Term
          label={t.availability}
          value={listing.availableFrom ? t.availableOn(formatDate(listing.availableFrom)) : t.availableNow}
          strong
        />
      </dl>
    </Section>
  );
}

const DOCUMENT_ICONS: readonly LucideIcon[] = [IdCard, FileText, ShieldCheck];

/** Rent only: what the future tenant prepares (the same list for every listing). */
export function ListingDocuments({ listing }: { listing: PublicListing }) {
  const t = useT().site.listing.documents;
  if (listing.kind !== 'rent') return null;
  return (
    <Section title={t.title}>
      <ul className="space-y-4">
        {t.items.map((item, index) => {
          const Icon = DOCUMENT_ICONS[index] ?? FileText;
          return (
            <li key={item.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary" aria-hidden="true">
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">{item.text}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
