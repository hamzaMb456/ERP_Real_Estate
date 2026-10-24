'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Search, SearchX } from '@/components/icons';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { newestFirst } from '@/lib/requests';
import type { QueryState } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';

type Item = { id: string; status: string; created_at: string };

/** Status chips (with counts), search and the list of cards, with the loading, error, empty and no-match states. */
export function RequestBoard<T extends Item>({
  result,
  statuses,
  statusLabel,
  filterLabel,
  matches,
  renderCard,
  emptyTitle,
  emptyBody,
}: {
  result: QueryState<T[]>;
  statuses: readonly string[];
  statusLabel: (status: string) => string;
  filterLabel: string;
  matches: (item: T, search: string) => boolean;
  renderCard: (item: T) => ReactNode;
  emptyTitle: string;
  emptyBody: string;
}) {
  const t = useT();
  const text = t.requests;
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const items = useMemo(() => (result.status === 'success' ? newestFirst(result.data) : []), [result]);
  const shown = items.filter((item) => (status === 'all' || item.status === status) && matches(item, search));
  const hasFilters = status !== 'all' || search !== '';
  const reset = () => {
    setStatus('all');
    setSearch('');
  };

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <Card className="py-4">
          <CardContent className="space-y-4">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={status}
              onValueChange={(value) => setStatus(value || 'all')}
              className="flex-wrap justify-start"
              aria-label={filterLabel}
            >
              {['all', ...statuses].map((value) => (
                <ToggleGroupItem key={value} value={value} className="gap-1.5">
                  {value === 'all' ? text.all : statusLabel(value)}
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                    {value === 'all' ? items.length : items.filter((item) => item.status === value).length}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <div className="flex flex-wrap items-center gap-3">
              <InputGroup className="min-w-64 flex-1 sm:max-w-sm">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={text.searchPlaceholder}
                  aria-label={text.search}
                />
              </InputGroup>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  {text.reset}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {result.status === 'loading' && (
        <SkeletonList count={4} className="grid gap-4 lg:grid-cols-2" itemClassName="h-64 rounded-xl bg-muted" label={text.loading} />
      )}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {text.loadError(result.message)}
        </p>
      )}
      {result.status === 'success' && shown.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" animation="draw" />
            </span>
            <p className="font-medium">{items.length === 0 ? emptyTitle : text.noMatchTitle}</p>
            <p className="text-sm text-muted-foreground">{items.length === 0 ? emptyBody : text.noMatchHint}</p>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={reset} className="mt-2">
                {text.reset}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      {result.status === 'success' && shown.length > 0 && (
        <StaggerItem>
          <div className="grid gap-4 lg:grid-cols-2">{shown.map((item) => renderCard(item))}</div>
        </StaggerItem>
      )}
    </Stagger>
  );
}
