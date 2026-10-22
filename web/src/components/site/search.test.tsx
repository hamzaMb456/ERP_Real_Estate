import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MESSAGES } from '@/i18n/messages';
import { I18nProvider } from '@/i18n/provider';
import { setLocale } from '@/i18n/store';
import type { PublicListing } from '@/lib/site/listings-queries';
import { parseSearchParams, type SearchMode } from '@/lib/site/search-params';
import { SearchFiltersPanel } from './search-filters';
import { toMapPoints } from './search-map';
import { SearchHeader, SearchResults } from './search-results';

vi.mock('@/components/map', () => ({
  ListingsMap: ({ points }: { points: { id: string }[] }) => <div data-testid="listings-map" data-count={points.length} />,
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockReset());
afterEach(() => setLocale('fr'));

const PAGE_SIZE = 12;
const CITIES = ['Carthage', 'La Marsa', 'Tunis'];

function makeListing(index: number, overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: `l-${index}`,
    organizationId: 'org-1',
    unitId: `u-${index}`,
    kind: 'rent',
    title: `Appartement S+2 numéro ${index}`,
    description: null,
    price: 1450,
    charges: null,
    depositMonths: 2,
    reservationDeposit: 0,
    reservationDays: 0,
    availableFrom: null,
    furnished: false,
    amenities: [],
    virtualTourUrl: null,
    publishedAt: null,
    unitType: 'apartment',
    rooms: 3,
    surfaceM2: 92,
    floor: 2,
    unitStatus: 'vacant',
    city: 'Carthage',
    governorate: 'Tunis',
    latitude: null,
    longitude: null,
    coverFileId: null,
    photoCount: 0,
    ...overrides,
  };
}

const listings = (count: number) => Array.from({ length: count }, (_, index) => makeListing(index + 1));

type ResultsProps = Partial<React.ComponentProps<typeof SearchResults>>;

function renderResults(props: ResultsProps = {}) {
  const mode: SearchMode = props.mode ?? 'rent';
  return render(
    <TooltipProvider>
      <SearchResults
        mode={mode}
        filters={props.filters ?? parseSearchParams({})}
        view={props.view ?? 'list'}
        items={props.items ?? listings(3)}
        total={props.total ?? 3}
        pageSize={PAGE_SIZE}
      />
    </TooltipProvider>,
  );
}

describe('active-filter chips', () => {
  it('links the Carthage chip to the same URL without ville=Carthage', () => {
    const filters = parseSearchParams({ ville: ['Carthage', 'Tunis'], prix_max: '2000' });
    renderResults({ filters });
    const chip = screen.getByRole('link', { name: /Carthage/ });
    expect(chip).toHaveAttribute('href', '/louer?ville=Tunis&prix_max=2000');
  });

  it('goes back to the bare path when the last filter is removed', () => {
    renderResults({ filters: parseSearchParams({ ville: 'Carthage' }) });
    expect(screen.getByRole('link', { name: /Carthage/ })).toHaveAttribute('href', '/louer');
  });

  it('removing a chip also leaves page 2 and keeps the map view', () => {
    renderResults({ filters: parseSearchParams({ ville: ['Carthage', 'Tunis'], page: '2' }), view: 'map', total: 30 });
    expect(screen.getByRole('link', { name: /Carthage/ })).toHaveAttribute('href', '/louer?ville=Tunis&vue=carte');
  });

  it('describes every kind of filter with a readable label', () => {
    const filters = parseSearchParams({
      type: 'office',
      prix_min: '500',
      prix_max: '2000',
      pieces: '3',
      surface_min: '40',
      meuble: '1',
      dispo: '2026-12-01',
    });
    renderResults({ filters });
    const chips = within(screen.getByRole('list', { name: MESSAGES.fr.site.search.chips.label })).getAllByRole('link');
    expect(chips).toHaveLength(7);
    expect(chips[0]).toHaveAccessibleName(/Bureau/);
  });
});

describe('filter column', () => {
  it('is a GET form to the bare path, resetting through a link to /louer', () => {
    const filters = parseSearchParams({ ville: 'Carthage', prix_max: '2000' });
    const { container } = render(<SearchFiltersPanel mode="rent" filters={filters} view="list" cities={CITIES} />);
    const form = container.querySelector('form') as HTMLFormElement;
    expect(form.getAttribute('method')).toBe('get');
    expect(form.getAttribute('action')).toBe('/louer');
    expect(screen.getByRole('link', { name: 'Réinitialiser' })).toHaveAttribute('href', '/louer');
    expect(screen.getByRole('button', { name: 'Appliquer les filtres' })).toHaveAttribute('type', 'submit');
    expect(form.querySelector('input[name="page"]')).toBeNull();
  });

  it('pre-fills the fields from the filters', () => {
    const filters = parseSearchParams({
      ville: 'Carthage',
      type: 'office',
      prix_min: '500',
      prix_max: '2000',
      pieces: '3',
      surface_min: '40',
      meuble: '1',
      dispo: '2026-12-01',
    });
    render(<SearchFiltersPanel mode="rent" filters={filters} view="list" cities={CITIES} />);
    expect(screen.getByRole('checkbox', { name: 'Carthage' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'La Marsa' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Bureau' })).toBeChecked();
    expect(screen.getByRole('spinbutton', { name: /Min/ })).toHaveValue(500);
    expect(screen.getByRole('spinbutton', { name: /Max/ })).toHaveValue(2000);
    expect(screen.getByRole('combobox', { name: 'Pièces' })).toHaveValue('3');
    expect(screen.getByRole('spinbutton', { name: /Surface/ })).toHaveValue(40);
    expect(screen.getByRole('checkbox', { name: 'Meublé' })).toBeChecked();
    expect(screen.getByLabelText(/Disponible à partir du/)).toHaveValue('2026-12-01');
  });

  it('keeps the map view through a hidden field and posts to /acheter for sales', () => {
    const { container } = render(<SearchFiltersPanel mode="sale" filters={parseSearchParams({})} view="map" cities={CITIES} />);
    expect(container.querySelector('form')?.getAttribute('action')).toBe('/acheter');
    expect(container.querySelector('input[type="hidden"][name="vue"]')).toHaveValue('carte');
    expect(screen.getByRole('link', { name: 'Réinitialiser' })).toHaveAttribute('href', '/acheter');
    expect(screen.queryByRole('checkbox', { name: 'Meublé' })).toBeNull();
  });

  it('opens and closes on small screens through a labelled button', async () => {
    const user = userEvent.setup();
    render(<SearchFiltersPanel mode="rent" filters={parseSearchParams({ ville: 'Carthage' })} view="list" cities={CITIES} />);
    const toggle = screen.getByRole('button', { name: /Filtres/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('submitting', () => {
  it('goes to the canonical URL: empty fields dropped, page back to 1, map view kept', async () => {
    const user = userEvent.setup();
    render(<SearchFiltersPanel mode="rent" filters={parseSearchParams({ page: '3' })} view="map" cities={CITIES} />);
    await user.click(screen.getByRole('checkbox', { name: 'La Marsa' }));
    await user.type(screen.getByRole('spinbutton', { name: /Max/ }), '2000');
    await user.click(screen.getByRole('button', { name: 'Appliquer les filtres' }));
    expect(push).toHaveBeenCalledWith('/louer?ville=La+Marsa&prix_max=2000&vue=carte');
  });

  it('applies a new sort at once, through the same form', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <SearchFiltersPanel mode="rent" filters={parseSearchParams({ ville: 'Carthage' })} view="list" cities={CITIES} />
        <SearchResults mode="rent" filters={parseSearchParams({ ville: 'Carthage' })} view="list" items={listings(2)} total={2} pageSize={PAGE_SIZE} />
      </TooltipProvider>,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Trier par' }), 'price_desc');
    expect(push).toHaveBeenCalledWith('/louer?ville=Carthage&tri=price_desc');
  });
});

describe('pagination', () => {
  it('links page 2 of 30 to pages 1 and 3 and keeps the filters', () => {
    const filters = parseSearchParams({ ville: 'Carthage', page: '2' });
    renderResults({ filters, total: 30, items: listings(PAGE_SIZE) });
    const nav = screen.getByRole('navigation', { name: MESSAGES.fr.site.search.pagination.label });
    expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute('href', '/louer?ville=Carthage');
    expect(within(nav).getByRole('link', { name: 'Page 3' })).toHaveAttribute('href', '/louer?ville=Carthage&page=3');
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent('2');
    expect(within(nav).getByRole('link', { name: 'Page précédente' })).toHaveAttribute('rel', 'prev');
    expect(within(nav).getByRole('link', { name: 'Page suivante' })).toHaveAttribute('rel', 'next');
    expect(within(nav).getByRole('link', { name: 'Page suivante' })).toHaveAttribute('href', '/louer?ville=Carthage&page=3');
  });

  it('shows a window around the current page with the first and last pages', () => {
    renderResults({ filters: parseSearchParams({ page: '10' }), total: 200, items: listings(PAGE_SIZE) });
    const nav = screen.getByRole('navigation', { name: MESSAGES.fr.site.search.pagination.label });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.getAttribute('aria-label'));
    expect(labels).toEqual([
      'Page précédente',
      'Page 1',
      'Page 8',
      'Page 9',
      'Page 11',
      'Page 12',
      'Page 17',
      'Page suivante',
    ]);
  });

  it('has no pagination for a single page and no previous link on page 1', () => {
    const { unmount } = renderResults({ total: 5, items: listings(5) });
    expect(screen.queryByRole('navigation', { name: MESSAGES.fr.site.search.pagination.label })).toBeNull();
    unmount();
    renderResults({ total: 30, items: listings(PAGE_SIZE) });
    expect(screen.queryByRole('link', { name: 'Page précédente' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Page suivante' })).toHaveAttribute('href', '/louer?page=2');
  });
});

describe('results', () => {
  it('shows the empty state with a reset link when nothing matches', () => {
    renderResults({ filters: parseSearchParams({ ville: 'Carthage' }), items: [], total: 0 });
    expect(screen.getByText('Aucun logement ne correspond à ces critères')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Réinitialiser les filtres' })).toHaveAttribute('href', '/louer');
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('points back to page 1 when the page is beyond the last one', () => {
    renderResults({ filters: parseSearchParams({ ville: 'Carthage', page: '9' }), items: [], total: 30 });
    expect(screen.getByRole('link', { name: 'Retour à la première page' })).toHaveAttribute('href', '/louer?ville=Carthage');
    expect(screen.queryByText('Aucun logement ne correspond à ces critères')).toBeNull();
  });

  it('renders one card per listing in the list view', () => {
    renderResults({ items: listings(3), total: 3 });
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.queryByTestId('listings-map')).toBeNull();
  });

  it('shows the map with the located listings only', () => {
    const items = [makeListing(1, { latitude: 36.85, longitude: 10.32 }), makeListing(2), makeListing(3, { latitude: 36.9, longitude: 10.3 })];
    renderResults({ view: 'map', items, total: 3 });
    expect(screen.getByTestId('listings-map')).toHaveAttribute('data-count', '2');
  });

  it('says so when no listing of the page can be placed on the map', () => {
    renderResults({ view: 'map', items: listings(2), total: 2 });
    expect(screen.queryByTestId('listings-map')).toBeNull();
    expect(screen.getByText(MESSAGES.fr.site.search.map.empty)).toBeInTheDocument();
  });

  it('shows the alert card with a disabled button', () => {
    renderResults();
    expect(screen.getByRole('heading', { name: 'Créer une alerte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer une alerte' })).toBeDisabled();
  });
});

describe('map points', () => {
  it('keeps only located listings and links each to its page, with the monthly price for rents', () => {
    const points = toMapPoints(
      [makeListing(1, { latitude: 36.85, longitude: 10.32 }), makeListing(2), makeListing(3, { kind: 'sale', price: 350000, latitude: 36.9, longitude: 10.3 })],
      { perMonth: '/ mois', linkLabel: 'Voir le logement' },
    );
    expect(points.map((point) => point.id)).toEqual(['l-1', 'l-3']);
    expect(points[0]).toMatchObject({ href: '/logement/l-1', linkLabel: 'Voir le logement', lat: 36.85, lon: 10.32 });
    expect(points[0].detail).toMatch(/450,000 TND \/ mois$/);
    expect(points[1].detail).not.toContain('mois');
  });
});

describe('header', () => {
  it('has the title, an agreeing count and the Louer / Acheter links', () => {
    const { rerender } = render(<SearchHeader mode="rent" filters={parseSearchParams({})} view="list" total={128} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Logements à louer' })).toBeInTheDocument();
    expect(screen.getByText('128 logements')).toBeInTheDocument();
    rerender(<SearchHeader mode="rent" filters={parseSearchParams({})} view="list" total={1} />);
    expect(screen.getByText('1 logement')).toBeInTheDocument();
    rerender(<SearchHeader mode="sale" filters={parseSearchParams({})} view="list" total={1} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Biens à vendre' })).toBeInTheDocument();
    expect(screen.getByText('1 bien')).toBeInTheDocument();
  });

  it('appends the city to the title when exactly one is selected', () => {
    render(<SearchHeader mode="rent" filters={parseSearchParams({ ville: 'Carthage' })} view="list" total={4} />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Logements à louer à Carthage');
  });

  it('keeps the city and drops the price filters when switching to Acheter', () => {
    const filters = parseSearchParams({ ville: 'Carthage', prix_min: '500', prix_max: '2000', meuble: '1', page: '3' });
    render(<SearchHeader mode="rent" filters={filters} view="list" total={40} />);
    expect(screen.getByRole('link', { name: 'Acheter' })).toHaveAttribute('href', '/acheter?ville=Carthage');
    expect(screen.getByRole('link', { name: 'Louer' })).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the map view when switching mode', () => {
    render(<SearchHeader mode="rent" filters={parseSearchParams({ ville: 'Carthage' })} view="map" total={4} />);
    expect(screen.getByRole('link', { name: 'Acheter' })).toHaveAttribute('href', '/acheter?ville=Carthage&vue=carte');
  });
});

describe('toolbar', () => {
  it('toggles list and map through links that keep the filters', () => {
    renderResults({ filters: parseSearchParams({ ville: 'Carthage', page: '2' }), total: 30, items: listings(PAGE_SIZE) });
    expect(screen.getByRole('link', { name: 'Liste' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Carte' })).toHaveAttribute('href', '/louer?ville=Carthage&page=2&vue=carte');
    expect(screen.getByRole('link', { name: 'Liste' })).toHaveAttribute('href', '/louer?ville=Carthage&page=2');
  });

  it('has a sort select tied to the filter form, selected on the current sort', () => {
    renderResults({ filters: parseSearchParams({ tri: 'price_asc' }) });
    const select = screen.getByRole('combobox', { name: 'Trier par' });
    expect(select).toHaveValue('price_asc');
    expect(select).toHaveAttribute('name', 'tri');
    expect(select.getAttribute('form')).toBeTruthy();
  });
});

describe('garbage in the URL', () => {
  const garbage = parseSearchParams({ prix_max: 'abc', page: '-3', pieces: '99', ville: '<script>alert(1)</script>' });

  it('renders the results with the city shown as text only', () => {
    const { container } = renderResults({ filters: garbage, items: [], total: 0 });
    expect(container.querySelector('script')).toBeNull();
    const chip = screen.getByRole('link', { name: /<script>alert\(1\)<\/script>/ });
    // The clamped rooms filter (99 -> 10) is the only other thing left in the URL.
    expect(chip).toHaveAttribute('href', '/louer?pieces=10');
    expect(screen.getByText('Aucun logement ne correspond à ces critères')).toBeInTheDocument();
  });

  it('renders the filter column and the header with those filters', () => {
    const { container } = render(
      <>
        <SearchHeader mode="rent" filters={garbage} view="list" total={0} />
        <SearchFiltersPanel mode="rent" filters={garbage} view="list" cities={CITIES} />
      </>,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByRole('checkbox', { name: '<script>alert(1)</script>' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Pièces' })).toHaveValue('10');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Logements à louer');
  });
});

describe('Arabic', () => {
  it('translates the title and the empty state', () => {
    setLocale('ar');
    render(
      <I18nProvider>
        <SearchHeader mode="rent" filters={parseSearchParams({})} view="list" total={3} />
        <TooltipProvider>
          <SearchResults mode="rent" filters={parseSearchParams({})} view="list" items={[]} total={0} pageSize={PAGE_SIZE} />
        </TooltipProvider>
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: MESSAGES.ar.site.search.rentTitle })).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.ar.site.search.empty.title)).toBeInTheDocument();
  });
});
