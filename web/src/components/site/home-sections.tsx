'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Clock,
  FileCheck,
  FilePlus2,
  Map as MapIcon,
  Pencil,
  Search,
  ShieldCheck,
  type LucideIcon,
} from '@/components/icons';
import { ScrollItem, StaggerItem } from '@/components/motion/primitives';
import { buttonVariants } from '@/components/ui/button-variants';
import { useT } from '@/i18n/provider';
import { formatNumber } from '@/lib/format';
import type { PublicListing } from '@/lib/site/listings-queries';
import { cn } from '@/lib/utils';
import { ListingCard } from './listing-card';

const SECTION = 'mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8';
const SURFACE = 'rounded-xl border border-primary/15 bg-card shadow-[0_1px_3px_rgb(0_0_0/0.05),0_12px_24px_-12px_rgb(4_120_87/0.18)]';

function StatCard({ icon: Icon, value, label }: { icon: LucideIcon; value: ReactNode; label: string }) {
  return (
    <li>
      <ScrollItem className={cn(SURFACE, 'flex h-full items-center gap-4 p-5 transition-colors hover:border-primary/40')}>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
          <Icon className="size-6" animation="none" />
        </span>
        <div className="min-w-0">
          <div className="font-heading-site text-lg font-bold text-foreground tabular-nums sm:text-xl">{value}</div>
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
        </div>
      </ScrollItem>
    </li>
  );
}

/** Four quick figures overlapping the bottom of the hero: published listings, cities and the two promises. */
export function HomeStats({ total, cities }: { total: number; cities: number }) {
  const t = useT().site.home.stats;
  return (
    <section aria-label={t.label} className={cn(SECTION, 'relative z-10 -mt-10 mb-20')}>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Building2} value={formatNumber(total, 0)} label={t.listings} />
        <StatCard icon={MapIcon} value={formatNumber(cities, 0)} label={t.cities} />
        <StatCard icon={Clock} value={t.visit} label={t.visitHint} />
        <StatCard icon={FileCheck} value={t.online} label={t.onlineHint} />
      </ul>
    </section>
  );
}

/** « Nouveautés à la location » or « À vendre »: the latest three cards, or an empty message. */
export function HomeListingsSection({ kind, listings }: { kind: 'rent' | 'sale'; listings: PublicListing[] }) {
  const site = useT().site.home;
  const t = kind === 'rent' ? site.rent : site.sale;
  const href = kind === 'rent' ? '/louer' : '/acheter';
  const headingId = `home-${kind}-title`;

  return (
    <section aria-labelledby={headingId} className={cn(SECTION, 'mb-24')}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <p className="mb-1 text-xs font-semibold tracking-wider text-primary uppercase">{t.eyebrow}</p>
          <h2 id={headingId} className="font-heading-site text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {t.title}
          </h2>
        </div>
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {t.all}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1"
            animation="none"
          />
        </Link>
      </div>

      {listings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-primary/25 bg-card/60 px-6 py-12 text-center text-sm text-muted-foreground">
          {t.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {listings.map((listing) => (
            <li key={listing.id}>
              <StaggerItem className="h-full">
                <ListingCard listing={listing} />
              </StaggerItem>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const STEP_ICONS: readonly LucideIcon[] = [Search, CalendarDays, FilePlus2, Pencil];

/** « Comment ça marche »: four steps. The header links to it with /#comment-ca-marche. */
export function HowItWorks() {
  const t = useT().site.home.how;
  return (
    <section id="comment-ca-marche" aria-labelledby="home-how-title" className={cn(SECTION, 'mb-24 scroll-mt-24')}>
      <div className={cn(SURFACE, 'p-6 sm:p-8 md:p-12')}>
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="size-4" animation="none" />
            {t.badge}
          </p>
          <h2 id="home-how-title" className="font-heading-site text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {t.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">{t.subtitle}</p>
        </div>

        <ol className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {t.steps.map((step, index) => {
            const Icon = STEP_ICONS[index] ?? Search;
            return (
              <li key={step.title}>
                <ScrollItem className="group flex h-full flex-col items-start">
                  <span className="mb-4 flex size-12 items-center justify-center rounded-xl border border-primary/15 bg-accent text-primary transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-6" animation="none" />
                  </span>
                  <p className="mb-1 text-xs font-bold tracking-wider text-primary uppercase">{t.step(index + 1)}</p>
                  <h3 className="mb-2 font-heading-site text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </ScrollItem>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

/** Closing call-to-action band in the sand colour of the Stitch design. */
export function SandBand() {
  const t = useT().site.home.band;
  return (
    <section className={cn(SECTION, 'mb-24')}>
      <ScrollItem className="relative flex flex-col items-center justify-between gap-6 overflow-hidden rounded-xl border border-(--sand-border) bg-(--sand) p-8 text-(--sand-text) shadow-sm md:flex-row md:p-12">
        <span aria-hidden="true" className="pointer-events-none absolute -end-12 -bottom-12 size-48 rounded-full bg-(--sand-deep)/40" />
        <div className="relative max-w-2xl">
          <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase opacity-80">
            <ShieldCheck className="size-4 text-primary" animation="none" />
            {t.eyebrow}
          </p>
          <h2 className="font-heading-site text-xl leading-snug font-bold tracking-tight md:text-2xl">{t.title}</h2>
          <p className="mt-2 text-sm opacity-85">{t.text}</p>
        </div>
        <Link
          href="/#contact"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'lg' }),
            'relative h-12 shrink-0 border-(--sand-border) bg-white/85 px-6 font-heading-site font-semibold text-(--sand-text) hover:bg-white',
          )}
        >
          {t.cta}
        </Link>
      </ScrollItem>
    </section>
  );
}
