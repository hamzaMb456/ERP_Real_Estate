'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { useT } from '@/i18n/provider';
import { formatNumber } from '@/lib/format';
import { searchHref, type SearchView } from '@/lib/site/search-links';
import type { SearchFilters, SearchMode } from '@/lib/site/search-params';
import { cn } from '@/lib/utils';

/** Pages on each side of the current one that get their own link. */
const PAGE_WINDOW = 2;

const ITEM =
  'inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';
const LINK = 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent';

type PageItem = { kind: 'page'; page: number } | { kind: 'gap'; key: string };

/** First page, last page and the window around the current one, with a gap marker where pages are skipped. */
export function pageItems(current: number, totalPages: number): PageItem[] {
  const wanted = new Set<number>([1, totalPages]);
  for (let page = current - PAGE_WINDOW; page <= current + PAGE_WINDOW; page += 1) {
    if (page >= 1 && page <= totalPages) wanted.add(page);
  }
  const pages = [...wanted].sort((a, b) => a - b);
  const items: PageItem[] = [];
  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined && page - previous > 1) items.push({ kind: 'gap', key: `gap-${page}` });
    items.push({ kind: 'page', page });
  });
  return items;
}

/** Previous / numbered / next links. Every link keeps the filters and the view; page 1 has no `page` parameter. */
export function SearchPagination({
  mode,
  filters,
  view,
  totalPages,
}: {
  mode: SearchMode;
  filters: SearchFilters;
  view: SearchView;
  totalPages: number;
}) {
  const t = useT().site.search.pagination;
  const current = Math.min(filters.page, totalPages);
  if (totalPages <= 1) return null;

  const hrefOf = (page: number) => searchHref(mode, { ...filters, page }, view);

  return (
    <nav aria-label={t.label} className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {current > 1 ? (
        <Link href={hrefOf(current - 1)} rel="prev" aria-label={t.previous} className={cn(ITEM, LINK)}>
          <ChevronLeft className="size-4 rtl:-scale-x-100" animation="none" />
          <span className="hidden sm:inline">{t.previous}</span>
        </Link>
      ) : null}

      {pageItems(current, totalPages).map((item) =>
        item.kind === 'gap' ? (
          <span key={item.key} aria-hidden="true" className="px-1 text-muted-foreground">
            …
          </span>
        ) : item.page === current ? (
          <span key={item.page} aria-current="page" className={cn(ITEM, 'border-primary bg-primary text-primary-foreground')}>
            {formatNumber(item.page, 0)}
          </span>
        ) : (
          <Link key={item.page} href={hrefOf(item.page)} aria-label={t.page(item.page)} className={cn(ITEM, LINK)}>
            {formatNumber(item.page, 0)}
          </Link>
        ),
      )}

      {current < totalPages ? (
        <Link href={hrefOf(current + 1)} rel="next" aria-label={t.next} className={cn(ITEM, LINK)}>
          <span className="hidden sm:inline">{t.next}</span>
          <ChevronRight className="size-4 rtl:-scale-x-100" animation="none" />
        </Link>
      ) : null}
    </nav>
  );
}
