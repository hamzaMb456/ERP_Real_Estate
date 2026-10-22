import { Suspense } from 'react';
import type { Metadata } from 'next';
import { MESSAGES } from '@/i18n/messages';
import { siteConfig } from '@/lib/site/config';
import { PAGE_SIZE, searchListings } from '@/lib/site/listings-queries';
import { parseView, SEARCH_PATH } from '@/lib/site/search-links';
import { parseSearchParams, type RawSearchParams, type SearchMode } from '@/lib/site/search-params';
import { SearchFiltersPanel } from './search-filters';
import { SearchHeader, SearchResults } from './search-results';
import { SearchSkeleton } from './search-skeleton';

export type SearchPageProps = { searchParams: Promise<RawSearchParams> };

/**
 * Metadata of /louer and /acheter. The public site is indexed in French only, so the server always uses the French
 * catalog. Only the bare page is the canonical one: filtered and paginated URLs point to it.
 */
export async function searchMetadata(mode: SearchMode, searchParams: Promise<RawSearchParams>): Promise<Metadata> {
  const filters = parseSearchParams(await searchParams);
  const t = MESSAGES.fr.site.search;
  const base = mode === 'rent' ? t.rentTitle : t.saleTitle;
  const title = filters.cities.length === 1 ? t.titleInCity(base, filters.cities[0]) : base;
  return {
    title,
    description: mode === 'rent' ? t.meta.rentDescription : t.meta.saleDescription,
    alternates: { canonical: `${siteConfig.siteUrl}${SEARCH_PATH[mode]}` },
  };
}

/**
 * The listings are read for the filters of the URL. `searchParams` is runtime data: it is awaited inside the
 * Suspense boundary, so the shell (frame, header, footer, skeleton) is prerendered and this part streams in.
 * `searchListings` never throws (an unreachable backend gives an empty page).
 */
async function SearchContent({ mode, searchParams }: { mode: SearchMode; searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const filters = parseSearchParams(raw);
  const view = parseView(raw);
  const { items, total, cities } = await searchListings(mode, filters);

  return (
    <>
      <SearchHeader mode={mode} filters={filters} view={view} total={total} />
      <div className="grid gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
        <SearchFiltersPanel mode={mode} filters={filters} view={view} cities={cities} />
        <SearchResults mode={mode} filters={filters} view={view} items={items} total={total} pageSize={PAGE_SIZE} />
      </div>
    </>
  );
}

/** Search page shared by /louer (rent) and /acheter (sale). */
export function SearchPage({ mode, searchParams }: { mode: SearchMode } & SearchPageProps) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Suspense fallback={<SearchSkeleton mode={mode} />}>
        <SearchContent mode={mode} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
