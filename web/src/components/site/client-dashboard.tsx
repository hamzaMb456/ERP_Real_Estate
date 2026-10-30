'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CalendarClock,
  EyeOff,
  Heart,
  Home,
  KeyRound,
  Search,
  FileText,
  Tag,
  Trash2,
  User,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { useT } from '@/i18n/provider';
import { formatTnd } from '@/lib/format';
import { publicImageUrl } from '@/lib/site/image-url';
import { accountHref, SIGN_IN_PATH } from '@/lib/site/account';
import { useClientSession } from '@/components/site/account-menu';
import { useFavorites } from '@/lib/site/favorites';
import { useGraphql } from '@/lib/use-graphql';
import { useHiddenListings, useRecentlyViewed, useSavedSearches } from '@/lib/site/client-space';
import { SEARCH_UNIT_TYPES, type SearchFilters, type SearchMode, type SearchUnitType } from '@/lib/site/search-params';
import { searchHref } from '@/lib/site/search-links';
import type { PublicListing } from '@/lib/site/listings-queries';
import { favoriteListingsAction } from '@/lib/site/request-actions';
import { cn } from '@/lib/utils';
import { ListingCard } from './listing-card';

const GET_VISITS = `query MyVisitsCount { visit_requests { id } }`;
const GET_RENTALS = `query MyRentalRequestsCount { rental_requests { id } }`;

function StatCard({
  icon: Icon,
  value,
  label,
  href,
}: {
  icon: typeof Heart;
  value: ReactNode;
  label: string;
  href?: string;
}) {
  const content = (
    <div className="flex h-full items-center gap-4 rounded-2xl border border-primary/10 bg-card p-5 shadow-xs transition-colors hover:border-primary/40 hover:shadow-sm">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="size-6" animation="none" />
      </span>
      <div className="min-w-0">
        <div className="font-heading-site text-2xl font-bold text-foreground tabular-nums">{value}</div>
        <div className="text-sm font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );

  return (
    <li>
      {href ? (
        <Link href={href} className="block h-full rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}

export function ClientDashboard({ cities = [] }: { cities?: string[] }) {
  const t = useT();
  const copy = t.site.dashboard;
  const labels = t.labels;
  const { ready, signedIn, name } = useClientSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !signedIn) router.replace(accountHref(SIGN_IN_PATH, pathname));
  }, [ready, signedIn, router, pathname]);

  // 1. Stats
  const { ids: favIds } = useFavorites();
  const savedSearches = useSavedSearches(signedIn);
  const hiddenListings = useHiddenListings(signedIn);
  const visitsState = useGraphql<{ visit_requests: { id: string }[] }>(signedIn ? GET_VISITS : '');
  const visitsCount = visitsState.status === 'success' ? visitsState.data.visit_requests.length : 0;
  const rentalsState = useGraphql<{ rental_requests: { id: string }[] }>(signedIn ? GET_RENTALS : '');
  const rentalsCount = rentalsState.status === 'success' ? rentalsState.data.rental_requests.length : 0;

  // 2. Save Search form state
  const [saveMode, setSaveMode] = useState<SearchMode>('rent');
  const [saveCity, setSaveCity] = useState<string>('');
  const [saveType, setSaveType] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSearch = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setIsSaving(true);
      setSaveStatus(null);
      try {
        const typeLabel = saveType ? labels.unitTypes[saveType] ?? saveType : copy.saved.anyType;
        const modeWord = copy.saved.modeWords[saveMode];
        const searchLabel = copy.saved.label(typeLabel, modeWord, saveCity);
        const filters: SearchFilters = {
          cities: saveCity ? [saveCity] : [],
          types: saveType ? [saveType as SearchUnitType] : [],
          sort: 'recent',
          page: 1,
        };
        const result = await savedSearches.save(searchLabel, saveMode, filters);
        if (result) {
          setSaveStatus({ kind: 'success', message: copy.saved.done });
        } else {
          setSaveStatus({ kind: 'error', message: copy.saved.failed });
        }
      } catch {
        setSaveStatus({ kind: 'error', message: copy.saved.failed });
      } finally {
        setIsSaving(false);
      }
    },
    [saveMode, saveCity, saveType, labels.unitTypes, copy.saved, savedSearches]
  );

  // 3. Hidden Listings loader
  const hiddenIdsKey = hiddenListings.ids.join(',');
  const [hiddenData, setHiddenData] = useState<{ key: string; listings: PublicListing[] }>({ key: '', listings: [] });
  useEffect(() => {
    if (!hiddenListings.ids.length) {
      setHiddenData({ key: '', listings: [] });
      return;
    }
    let active = true;
    void favoriteListingsAction(hiddenListings.ids)
      .then((items) => active && setHiddenData({ key: hiddenIdsKey, listings: items }))
      .catch(() => active && setHiddenData({ key: hiddenIdsKey, listings: [] }));
    return () => {
      active = false;
    };
  }, [hiddenIdsKey, hiddenListings.ids]);

  const hiddenMap = useMemo(() => new Map(hiddenData.listings.map((item) => [item.id, item])), [hiddenData.listings]);

  // 4. Recently Viewed loader
  const recentlyViewed = useRecentlyViewed(signedIn);
  const viewedIdsKey = recentlyViewed.ids.join(',');
  const [recentData, setRecentData] = useState<{ key: string; listings: PublicListing[] }>({ key: '', listings: [] });
  useEffect(() => {
    if (!recentlyViewed.ids.length) {
      setRecentData({ key: '', listings: [] });
      return;
    }
    let active = true;
    void favoriteListingsAction(recentlyViewed.ids)
      .then((items) => active && setRecentData({ key: viewedIdsKey, listings: items }))
      .catch(() => active && setRecentData({ key: viewedIdsKey, listings: [] }));
    return () => {
      active = false;
    };
  }, [viewedIdsKey, recentlyViewed.ids]);

  if (!ready || !signedIn) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">{copy.loading}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-12">
      {/* Top greeting and header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-heading-site text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {copy.greeting(name)}
          </h1>
          <p className="mt-2 text-muted-foreground">{copy.subtitle}</p>
        </div>
        <Link
          href="/compte/profil"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'gap-2')}
        >
          <User className="size-4 text-primary" aria-hidden="true" />
          {copy.profileCta}
        </Link>
      </header>

      {/* 4 Stat Cards */}
      <section aria-label={t.site.dashboard.metaTitle}>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            icon={Heart}
            value={favIds.length}
            label={copy.stats.favourites}
            href="/favoris"
          />
          <StatCard
            icon={Search}
            value={savedSearches.items.length}
            label={copy.stats.savedSearches}
            href="#recherches-sauvegardees"
          />
          <StatCard
            icon={EyeOff}
            value={hiddenListings.ids.length}
            label={copy.stats.hidden}
            href="#annonces-masquees"
          />
          <StatCard
            icon={CalendarClock}
            value={visitsCount}
            label={copy.stats.visits}
            href="/compte/visites"
          />
          <StatCard
            icon={FileText}
            value={rentalsCount}
            label={copy.stats.rentals}
            href="/compte/demandes"
          />
        </ul>
      </section>

      {/* Saved Searches Section */}
      <section id="recherches-sauvegardees" className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
        <div className="mb-6">
          <h2 className="font-heading-site text-xl font-bold text-foreground sm:text-2xl">
            {copy.saved.title}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.saved.text}</p>
        </div>

        {/* Quick Save Form */}
        <form onSubmit={handleSaveSearch} className="mb-8 rounded-xl border border-border/80 bg-accent/40 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {copy.saved.modeLabel}
              </label>
              <div className="flex h-10 rounded-lg border border-input bg-card p-1">
                <button
                  type="button"
                  onClick={() => setSaveMode('rent')}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors',
                    saveMode === 'rent' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <KeyRound className="size-3.5" animation="none" />
                  {copy.saved.rent}
                </button>
                <button
                  type="button"
                  onClick={() => setSaveMode('sale')}
                  className={cn(
                    'flex-1 inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-semibold transition-colors',
                    saveMode === 'sale' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Home className="size-3.5" animation="none" />
                  {copy.saved.buy}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="saved-search-city" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {copy.saved.city}
              </label>
              <select
                id="saved-search-city"
                value={saveCity}
                onChange={(e) => setSaveCity(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{copy.saved.cityPlaceholder}</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="saved-search-type" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {copy.saved.type}
              </label>
              <select
                id="saved-search-type"
                value={saveType}
                onChange={(e) => setSaveType(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{copy.saved.anyType}</option>
                {SEARCH_UNIT_TYPES.map((unitType) => (
                  <option key={unitType} value={unitType}>
                    {labels.unitTypes[unitType] ?? unitType}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              {saveStatus ? (
                <p
                  role="status"
                  className={cn('text-xs font-medium', saveStatus.kind === 'success' ? 'text-success' : 'text-destructive')}
                >
                  {saveStatus.message}
                </p>
              ) : null}
            </div>
            <Button type="submit" disabled={isSaving} size="default" className="ms-auto">
              {isSaving ? copy.saved.saving : copy.saved.submit}
            </Button>
          </div>
        </form>

        {/* Saved Searches List */}
        {savedSearches.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.saved.empty}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {savedSearches.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-accent/30 transition-colors">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {copy.saved.modeWords[item.mode]}
                    {item.filters.cities.length ? ` • ${item.filters.cities.join(', ')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={searchHref(item.mode, item.filters)}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                  >
                    {copy.saved.rerun}
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copy.saved.remove}
                    title={copy.saved.remove}
                    onClick={() => void savedSearches.remove(item.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Hidden Listings Section */}
      <section id="annonces-masquees" className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-xs">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-heading-site text-xl font-bold text-foreground sm:text-2xl">
              {copy.hidden.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{copy.hidden.text}</p>
          </div>
          {hiddenListings.ids.length > 0 ? (
            <span className="text-xs font-medium text-muted-foreground">
              {copy.hidden.count(hiddenListings.ids.length)}
            </span>
          ) : null}
        </div>

        {hiddenListings.ids.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.hidden.empty}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {hiddenListings.ids.map((id) => {
              const listing = hiddenMap.get(id);
              if (!listing) {
                return (
                  <li key={id} className="flex items-center justify-between gap-4 p-4">
                    <span className="text-sm text-muted-foreground">{copy.hidden.gone}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void hiddenListings.unhide(id)}
                    >
                      {copy.hidden.show}
                    </Button>
                  </li>
                );
              }
              return (
                <li key={id} className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {listing.coverFileId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={publicImageUrl(listing.coverFileId, 160)}
                          alt={listing.title}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-muted-foreground">
                          <Home className="size-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/logement/${listing.id}`}
                        className="font-semibold text-foreground hover:underline line-clamp-1"
                      >
                        {listing.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {listing.city ? `${listing.city} • ` : ''}
                        <span dir="ltr" className="font-medium text-primary">
                          {formatTnd(listing.price)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void hiddenListings.unhide(id)}
                  >
                    {copy.hidden.show}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Recently Viewed Section */}
      <section className="space-y-6">
        <div>
          <h2 className="font-heading-site text-xl font-bold text-foreground sm:text-2xl">
            {copy.recent.title}
          </h2>
        </div>

        {recentlyViewed.ids.length === 0 || recentData.listings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/25 bg-card/60 px-6 py-12 text-center">
            <Tag className="size-8 text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{copy.recent.empty}</p>
            <Link href="/louer" className={cn(buttonVariants({ size: 'default' }), 'mt-2')}>
              {copy.recent.browse}
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recentData.listings.map((listing) => (
              <li key={listing.id} className="min-w-0">
                <ListingCard listing={listing} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
