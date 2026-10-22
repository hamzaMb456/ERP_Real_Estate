'use client';

import { useId, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote, Home, KeyRound, MapPin, Search } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useT } from '@/i18n/provider';
import { parseSearchParams, SEARCH_UNIT_TYPES, toQueryString, type SearchMode } from '@/lib/site/search-params';
import { cn } from '@/lib/utils';

// Radix Select cannot hold an empty value, so "no filter" travels as this sentinel.
const ALL = '__all__';
const LISTING_PATH: Record<SearchMode, string> = { rent: '/louer', sale: '/acheter' };

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** "2 500", "2500,5" or "٢٥٠٠" -> "2500" / "2500.5"; anything else -> "" (the search is then not budget-limited). */
function normaliseBudget(raw: string): string {
  const latin = raw
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - EXTENDED_ARABIC_INDIC_ZERO))
    .replace(/[\s  ]/g, '')
    .replace(',', '.');
  return /^\d+(\.\d+)?$/.test(latin) ? latin : '';
}

const FIELD_LABEL = 'flex items-center gap-1.5 font-heading-site text-xs font-semibold text-muted-foreground';
const FIELD_ICON = 'size-4 text-primary';

/**
 * Home hero: title, subtitle and the search card. The form sends the visitor to /louer or /acheter with the same
 * query string the listing pages read (parseSearchParams clamps whatever was typed, toQueryString writes it).
 */
export function HomeHero({ cities }: { cities: string[] }) {
  const t = useT().site.home.hero;
  const unitTypeLabels = useT().labels.unitTypes;
  const router = useRouter();
  const ids = { city: useId(), type: useId(), budget: useId() };
  const [mode, setMode] = useState<SearchMode>('rent');
  const [city, setCity] = useState(ALL);
  const [unitType, setUnitType] = useState(ALL);
  const [budget, setBudget] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const filters = parseSearchParams({
      ville: city === ALL ? undefined : city,
      type: unitType === ALL ? undefined : unitType,
      prix_max: normaliseBudget(budget) || undefined,
    });
    const query = toQueryString(filters);
    router.push(query ? `${LISTING_PATH[mode]}?${query}` : LISTING_PATH[mode]);
  }

  return (
    <section className="px-4 pt-4 pb-16 sm:px-6 sm:pt-6 lg:px-8">
      <div className="relative mx-auto flex min-h-[560px] w-full max-w-7xl flex-col justify-between overflow-hidden rounded-2xl shadow-[0_1px_3px_rgb(0_0_0/0.05),0_12px_24px_-12px_rgb(4_120_87/0.18)]">
        {/* Original illustration (public/site/hero.svg), decorative. A licence-free photo can replace it at the same path. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- static decorative SVG, nothing for next/image to optimise */}
        <img src="/site/hero.svg" alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-emerald-950/70 via-emerald-950/20 to-emerald-950/5" />

        <div className="relative max-w-3xl px-6 pt-12 text-white sm:px-10 sm:pt-16 lg:px-12">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur-md">
            <span aria-hidden="true" className="size-2 rounded-full bg-emerald-300" />
            {t.badge}
          </p>
          <h1 className="font-heading-site text-3xl leading-[1.18] font-bold tracking-tight text-balance drop-shadow-sm sm:text-4xl lg:text-5xl">
            {t.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/90 md:text-lg">{t.subtitle}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="relative mx-4 mt-10 mb-4 rounded-xl border border-white/80 bg-white/95 p-4 shadow-2xl backdrop-blur-md sm:mx-8 sm:mb-8 sm:p-6"
        >
          <div role="group" aria-label={t.modeLabel} className="mb-5 inline-flex rounded-lg border border-border bg-secondary p-1">
            {(
              [
                { value: 'rent', label: t.rent, Icon: KeyRound },
                { value: 'sale', label: t.buy, Icon: Home },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  mode === value ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-4" animation="none" />
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.city} className={FIELD_LABEL}>
                <MapPin className={FIELD_ICON} animation="none" />
                {t.city}
              </Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger id={ids.city} className="h-11 w-full text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="site-root">
                  <SelectItem value={ALL}>{t.allCities}</SelectItem>
                  {cities.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.type} className={FIELD_LABEL}>
                <Home className={FIELD_ICON} animation="none" />
                {t.type}
              </Label>
              <Select value={unitType} onValueChange={setUnitType}>
                <SelectTrigger id={ids.type} className="h-11 w-full text-sm font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="site-root">
                  <SelectItem value={ALL}>{t.allTypes}</SelectItem>
                  {SEARCH_UNIT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {unitTypeLabels[type] ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.budget} className={FIELD_LABEL}>
                <Banknote className={FIELD_ICON} animation="none" />
                {t.budget} ({t.currency})
              </Label>
              <div className="relative">
                <Input
                  id={ids.budget}
                  name="prix_max"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  value={budget}
                  onChange={(event) => setBudget(event.target.value)}
                  placeholder={t.budgetPlaceholder}
                  className="h-11 pe-14 text-sm font-semibold tabular-nums"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute end-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground"
                >
                  {t.currency}
                </span>
              </div>
            </div>

            <Button type="submit" size="lg" className="h-11 gap-2 px-6 text-sm font-semibold sm:col-span-2 lg:col-span-1">
              <Search className="size-5" />
              {t.search}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
