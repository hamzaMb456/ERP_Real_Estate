'use client';

import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import { Bell, Home, KeyRound, List, Map as MapIcon, SearchX, X } from '@/components/icons';
import { StaggerItem } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useT } from '@/i18n/provider';
import { formatArea, formatTnd } from '@/lib/format';
import { formatDate } from '@/lib/ownership';
import type { PublicListing } from '@/lib/site/listings-queries';
import { activeFilters, removeFilter, SEARCH_PATH, searchHref, switchMode, type ActiveFilter, type SearchView } from '@/lib/site/search-links';
import type { SearchFilters, SearchMode, SearchSort } from '@/lib/site/search-params';
import { cn } from '@/lib/utils';
import { ListingCard } from './listing-card';
import { QuickFilters } from './quick-filters';
import { SearchMap } from './search-map';
import { SearchPagination } from './search-pagination';
import { NativeSelect, SEARCH_FORM_ID } from './search-filters';

const SORTS: readonly SearchSort[] = ['recent', 'price_asc', 'price_desc'];
const SEGMENT_LINK =
  'flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

function Segment({ active, href, children }: { active: boolean; href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(SEGMENT_LINK, active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
    >
      {children}
    </Link>
  );
}

/** Title, result count and the Louer / Acheter switch (links: the filters that still make sense travel with them). */
export function SearchHeader({ mode, filters, view, total }: { mode: SearchMode; filters: SearchFilters; view: SearchView; total: number }) {
  const t = useT().site.search;
  const baseTitle = mode === 'rent' ? t.rentTitle : t.saleTitle;
  const title = filters.cities.length === 1 ? t.titleInCity(baseTitle, filters.cities[0]) : baseTitle;
  const hrefTo = (target: SearchMode) =>
    target === mode ? searchHref(mode, filters, view) : searchHref(target, switchMode(filters, target), view);

  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="font-heading-site text-2xl font-bold tracking-tight text-balance text-foreground [overflow-wrap:anywhere] sm:text-3xl">{title}</h1>
        <p aria-live="polite" className="mt-1 text-sm font-medium text-muted-foreground">
          {t.count[mode](total)}
        </p>
      </div>
      <nav aria-label={t.modeLabel} className="inline-flex rounded-lg border border-border bg-secondary p-1">
        <Segment active={mode === 'rent'} href={hrefTo('rent')}>
          <KeyRound className="size-4" animation="none" />
          {t.rent}
        </Segment>
        <Segment active={mode === 'sale'} href={hrefTo('sale')}>
          <Home className="size-4" animation="none" />
          {t.buy}
        </Segment>
      </nav>
    </header>
  );
}

function SortSelect({ sort }: { sort: SearchSort }) {
  const t = useT().site.search.sort;
  const id = useId();
  return (
    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
      <label htmlFor={id} className="whitespace-nowrap">
        {t.label}
      </label>
      {/* Part of the filter form through `form`; with JavaScript a change applies at once, without it « Appliquer » does. */}
      <NativeSelect
        key={sort}
        id={id}
        name="tri"
        form={SEARCH_FORM_ID}
        defaultValue={sort}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-9 w-auto min-w-40"
      >
        {SORTS.map((value) => (
          <option key={value} value={value}>
            {t[value]}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

function ViewToggle({ mode, filters, view }: { mode: SearchMode; filters: SearchFilters; view: SearchView }) {
  const t = useT().site.search;
  return (
    <nav aria-label={t.viewLabel} className="inline-flex rounded-lg border border-border bg-secondary p-1">
      <Segment active={view === 'list'} href={searchHref(mode, filters, 'list')}>
        <List className="size-4" animation="none" />
        {t.showList}
      </Segment>
      <Segment active={view === 'map'} href={searchHref(mode, filters, 'map')}>
        <MapIcon className="size-4" animation="none" />
        {t.showMap}
      </Segment>
    </nav>
  );
}

function useChipLabel() {
  const t = useT();
  const copy = t.site.search.chips;
  return (chip: ActiveFilter): string => {
    switch (chip.kind) {
      case 'city':
        return chip.value;
      case 'type':
        return t.labels.unitTypes[chip.value] ?? chip.value;
      case 'priceMin':
        return copy.priceMin(formatTnd(chip.value));
      case 'priceMax':
        return copy.priceMax(formatTnd(chip.value));
      case 'rooms':
        return copy.rooms(chip.value);
      case 'surface':
        return copy.surface(formatArea(chip.value));
      case 'furnished':
        return copy.furnished;
      case 'availableFrom':
        return copy.availableFrom(formatDate(chip.value));
    }
  };
}

/** Removable filters: each chip is a link to the same search without that one value. */
function ActiveChips({ mode, filters, view }: { mode: SearchMode; filters: SearchFilters; view: SearchView }) {
  const t = useT().site.search.chips;
  const labelOf = useChipLabel();
  const chips = activeFilters(filters);
  if (chips.length === 0) return null;
  return (
    <ul aria-label={t.label} className="mb-6 flex flex-wrap gap-2">
      {chips.map((chip) => {
        const label = labelOf(chip);
        return (
          <li key={chip.id} className="max-w-full">
            <Link
              href={searchHref(mode, removeFilter(filters, chip), view)}
              aria-label={t.remove(label)}
              className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition-colors hover:border-primary/50 hover:bg-accent/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="min-w-0 truncate">{label}</span>
              <X className="size-3.5 shrink-0 opacity-70 group-hover:opacity-100" animation="none" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({ mode, filters, view, beyondLastPage }: { mode: SearchMode; filters: SearchFilters; view: SearchView; beyondLastPage: boolean }) {
  const t = useT().site.search.empty;
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-card/60 px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-accent text-primary">
        <SearchX className="size-7" animation="draw" aria-hidden="true" />
      </span>
      <h2 className="font-heading-site text-lg font-semibold text-foreground">{beyondLastPage ? t.beyondTitle : t.title}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{beyondLastPage ? t.beyondText : t.text}</p>
      {beyondLastPage ? (
        <Link href={searchHref(mode, { ...filters, page: 1 }, view)} className={cn(buttonVariants({ variant: 'outline' }), 'mt-2')}>
          {t.firstPage}
        </Link>
      ) : (
        <Link href={SEARCH_PATH[mode]} className={cn(buttonVariants({ variant: 'outline' }), 'mt-2')}>
          {t.reset}
        </Link>
      )}
    </div>
  );
}

/** « Créer une alerte »: arrives with the client area (slice 4), the button stays disabled until then. */
function AlertCard() {
  const t = useT().site.search.alert;
  return (
    <aside className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-accent/60 p-6">
      <div className="flex min-w-0 items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-sm">
          <Bell className="size-5" animation="none" />
        </span>
        <div className="min-w-0">
          <h2 className="font-heading-site text-base font-semibold text-foreground">{t.title}</h2>
          <p className="text-sm text-muted-foreground">{t.text}</p>
        </div>
      </div>
      {/* A disabled button fires no pointer events: the tooltip hangs on the wrapper. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex rounded-lg" tabIndex={0}>
            <Button type="button" disabled>
              {t.button}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{t.soon}</TooltipContent>
      </Tooltip>
    </aside>
  );
}

/** Right-hand column: view and sort controls, active-filter chips, the grid or map, pagination and the alert card. */
export function SearchResults({
  mode,
  filters,
  view,
  items,
  total,
  pageSize,
}: {
  mode: SearchMode;
  filters: SearchFilters;
  view: SearchView;
  items: PublicListing[];
  total: number;
  pageSize: number;
}) {
  const quick = useT().site.quick;
  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <ViewToggle mode={mode} filters={filters} view={view} />
        <SortSelect sort={filters.sort} />
      </div>
      <QuickFilters mode={mode} filters={filters} view={view} labels={quick} />
      <ActiveChips mode={mode} filters={filters} view={view} />

      {items.length === 0 ? (
        <EmptyState mode={mode} filters={filters} view={view} beyondLastPage={total > 0} />
      ) : view === 'map' ? (
        <SearchMap listings={items} />
      ) : (
        // On wide screens the list keeps a map beside it, with the price of each listing on its pin.
        <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_23rem] xl:items-start xl:gap-6">
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {items.map((listing) => (
              <li key={listing.id} className="min-w-0">
                <StaggerItem className="h-full">
                  <ListingCard listing={listing} />
                </StaggerItem>
              </li>
            ))}
          </ul>
          <div className="sticky top-24 hidden h-[calc(100dvh-8rem)] xl:block">
            <SearchMap listings={items} className="h-full" />
          </div>
        </div>
      )}

      <SearchPagination mode={mode} filters={filters} view={view} totalPages={Math.ceil(total / pageSize)} />
      <AlertCard />
    </div>
  );
}
