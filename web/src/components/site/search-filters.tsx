'use client';

import { useId, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, SlidersHorizontal } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/provider';
import { activeFilters, SEARCH_PATH, searchHref, type SearchView } from '@/lib/site/search-links';
import {
  parseSearchParams,
  SEARCH_UNIT_TYPES,
  toQueryString,
  type RawSearchParams,
  type SearchFilters,
  type SearchMode,
} from '@/lib/site/search-params';
import { cn } from '@/lib/utils';

/** Id of the filter form: the sort select of the results toolbar lives elsewhere in the page but belongs to it. */
export const SEARCH_FORM_ID = 'search-filters-form';

const ROOM_CHOICES = [1, 2, 3, 4, 5, 6];
const LEGEND = 'mb-2 block font-heading-site text-sm font-semibold text-foreground';
const CHECK_ROW = 'flex min-h-8 cursor-pointer items-center gap-2.5 text-sm text-foreground';
const CHECKBOX = 'size-4 shrink-0 cursor-pointer rounded-[4px] accent-primary';

/** Native <select>: works without JavaScript and takes the same field look as the Input (data-slot hook). */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
      {...props}
    />
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Values of the form as the raw search params the URL parser reads (repeated names become arrays). */
function rawParamsOf(form: HTMLFormElement): RawSearchParams {
  const raw: Record<string, string | string[]> = {};
  for (const [name, value] of new FormData(form)) {
    if (typeof value !== 'string') continue;
    const previous = raw[name];
    raw[name] = previous === undefined ? value : [...(Array.isArray(previous) ? previous : [previous]), value];
  }
  return raw;
}

/** Selected cities that the published list does not know (e.g. from a typed URL) stay listed so they can be unticked. */
function cityChoices(cities: string[], selected: string[]): string[] {
  return [...cities, ...selected.filter((city) => !cities.includes(city))];
}

function roomChoices(selected: number | undefined): number[] {
  if (selected === undefined || ROOM_CHOICES.includes(selected)) return ROOM_CHOICES;
  return [...ROOM_CHOICES, selected].sort((a, b) => a - b);
}

/**
 * Filter column of the search pages: a real GET form (works without JavaScript; the sort select of the toolbar joins
 * it through its `form` attribute). With JavaScript the submit is turned into a client navigation to the canonical
 * URL (empty fields dropped, page back to 1). On small screens the form folds behind a « Filtres » button; the
 * noscript rule keeps it open when scripts are off.
 */
export function SearchFiltersPanel({
  mode,
  filters,
  view,
  cities,
}: {
  mode: SearchMode;
  filters: SearchFilters;
  view: SearchView;
  cities: string[];
}) {
  const t = useT();
  const copy = t.site.search.filters;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ids = { panel: useId(), min: useId(), max: useId(), rooms: useId(), surface: useId(), date: useId() };
  const unitTypeLabels = t.labels.unitTypes;
  const activeCount = activeFilters(filters).length;
  const isRent = mode === 'rent';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = parseSearchParams(rawParamsOf(event.currentTarget));
    setOpen(false);
    router.push(searchHref(mode, next, view));
  }

  return (
    // Sticky on desktop; a form taller than the screen scrolls inside the column instead of hiding its buttons.
    <div className="lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:rounded-2xl">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={ids.panel}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-primary" animation="none" />
          {activeCount > 0 ? copy.toggleCount(activeCount) : copy.toggle}
        </span>
        <ChevronDown className={cn('size-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} animation="none" />
      </button>
      <noscript>
        <style>{`[data-search-panel]{display:block!important}`}</style>
      </noscript>

      <div id={ids.panel} data-search-panel="" className={cn('mt-3 lg:mt-0 lg:block', open ? 'block' : 'hidden')}>
        <form
          key={`${toQueryString(filters)}|${view}`}
          id={SEARCH_FORM_ID}
          method="get"
          action={SEARCH_PATH[mode]}
          onSubmit={handleSubmit}
          className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 shadow-sm"
        >
          <h2 className="hidden font-heading-site text-lg font-bold text-foreground lg:block">{copy.title}</h2>
          {view === 'map' ? <input type="hidden" name="vue" value="carte" /> : null}

          {cityChoices(cities, filters.cities).length > 0 ? (
            <fieldset>
              <legend className={LEGEND}>{copy.city}</legend>
              <div className="flex max-h-48 flex-col overflow-y-auto pe-1">
                {cityChoices(cities, filters.cities).map((city) => (
                  <label key={city} className={CHECK_ROW}>
                    <input type="checkbox" name="ville" value={city} defaultChecked={filters.cities.includes(city)} className={CHECKBOX} />
                    <span className="min-w-0 truncate">{city}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <fieldset>
            <legend className={LEGEND}>{copy.type}</legend>
            <div className="flex flex-col">
              {SEARCH_UNIT_TYPES.map((type) => (
                <label key={type} className={CHECK_ROW}>
                  <input type="checkbox" name="type" value={type} defaultChecked={filters.types.includes(type)} className={CHECKBOX} />
                  {unitTypeLabels[type] ?? type}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={LEGEND}>{isRent ? copy.priceRent : copy.priceSale}</legend>
            <div className="grid grid-cols-2 gap-3">
              <Field label={copy.min} htmlFor={ids.min}>
                <Input id={ids.min} name="prix_min" type="number" inputMode="numeric" min={0} step="any" defaultValue={filters.priceMin ?? ''} className="h-10 tabular-nums" />
              </Field>
              <Field label={copy.max} htmlFor={ids.max}>
                <Input id={ids.max} name="prix_max" type="number" inputMode="numeric" min={0} step="any" defaultValue={filters.priceMax ?? ''} className="h-10 tabular-nums" />
              </Field>
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Field label={copy.rooms} htmlFor={ids.rooms}>
              <NativeSelect id={ids.rooms} name="pieces" defaultValue={filters.roomsMin === undefined ? '' : String(filters.roomsMin)}>
                <option value="">{copy.roomsAny}</option>
                {roomChoices(filters.roomsMin).map((count) => (
                  <option key={count} value={count}>
                    {copy.roomsAtLeast(count)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={copy.surface} htmlFor={ids.surface}>
              <Input id={ids.surface} name="surface_min" type="number" inputMode="numeric" min={0} step="any" defaultValue={filters.surfaceMin ?? ''} className="h-10 tabular-nums" />
            </Field>
          </div>

          {isRent ? (
            <>
              <label className={CHECK_ROW}>
                <input type="checkbox" name="meuble" value="1" defaultChecked={filters.furnished === true} className={CHECKBOX} />
                {copy.furnished}
              </label>
              <Field label={copy.availableFrom} htmlFor={ids.date}>
                <Input id={ids.date} name="dispo" type="date" defaultValue={filters.availableFrom ?? ''} className="h-10" />
              </Field>
            </>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button type="submit" size="lg" className="h-10 w-full font-semibold">
              {copy.apply}
            </Button>
            <Link href={SEARCH_PATH[mode]} className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'h-10 w-full')}>
              {copy.reset}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
