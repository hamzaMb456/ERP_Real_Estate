import Link from 'next/link';
import type { MESSAGES } from '@/i18n/messages';
import { todayTunis } from '@/lib/dates';
import { searchHref, type SearchView } from '@/lib/site/search-links';
import type { SearchFilters, SearchMode } from '@/lib/site/search-params';
import { cn } from '@/lib/utils';

type Quick = {
  id: string;
  label: string;
  active: boolean;
  /** The filters once the chip is switched (on or off). */
  next: SearchFilters;
};

/** A row of one-tap filters above the results: each chip switches one filter and resets to the first page. */
export function quickFilters(filters: SearchFilters, labels: typeof MESSAGES.fr.site.quick, today: string): Quick[] {
  const base: SearchFilters = { ...filters, page: 1 };
  const withoutRooms: SearchFilters = { ...base, roomsMin: undefined };
  const rooms = (min: number, label: string): Quick => ({
    id: `rooms${min}`,
    label,
    active: filters.roomsMin === min,
    next: filters.roomsMin === min ? withoutRooms : { ...base, roomsMin: min },
  });
  return [
    { id: 'furnished', label: labels.furnished, active: filters.furnished === true, next: { ...base, furnished: filters.furnished ? undefined : true } },
    rooms(2, labels.rooms2),
    rooms(3, labels.rooms3),
    rooms(4, labels.rooms4),
    {
      id: 'availableNow',
      label: labels.availableNow,
      active: filters.availableFrom === today,
      next: { ...base, availableFrom: filters.availableFrom === today ? undefined : today },
    },
  ];
}

/** Server component: the chips are plain links, so they work without JavaScript and keep the view (list or map). */
export function QuickFilters({ mode, filters, view, labels }: { mode: SearchMode; filters: SearchFilters; view: SearchView; labels: typeof MESSAGES.fr.site.quick }) {
  const chips = quickFilters(filters, labels, todayTunis());
  return (
    <nav aria-label={labels.label} className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {chips.map((chip) => (
        <Link
          key={chip.id}
          href={searchHref(mode, chip.next, view)}
          aria-current={chip.active ? 'true' : undefined}
          scroll={false}
          className={cn(
            'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/60',
            chip.active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground hover:border-primary/40',
          )}
        >
          {chip.label}
        </Link>
      ))}
    </nav>
  );
}
