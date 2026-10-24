import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider } from '@/i18n/provider';
import { setLocale } from '@/i18n/store';
import { publicImageUrl } from '@/lib/site/image-url';
import { NO_DETAILS } from '@/lib/site/listing-details';
import type { PublicListing } from '@/lib/site/listings-queries';
import { safeTourUrl, telHref } from '@/lib/site/listing-links';
import { ListingPageContent } from './listing-page-content';

// The request dialog talks to the server through server actions; they are never called while the page is only displayed.
vi.mock('@/lib/site/request-actions', () => ({
  submitRentalRequestAction: vi.fn(),
  submitVisitRequestAction: vi.fn(),
  takenVisitSlotsAction: vi.fn(async () => []),
  favoriteListingsAction: vi.fn(async () => []),
}));

const mapProps = vi.fn();
vi.mock('@/components/map', () => ({
  ListingsMap: (props: { points: { id: string; lat: number; lon: number }[]; label: string }) => {
    mapProps(props);
    return <div role="region" aria-label={props.label} data-testid="listing-map" />;
  },
}));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/' }));

afterEach(() => {
  setLocale('fr');
  mapProps.mockReset();
});

function makeListing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'l-1',
    organizationId: 'org-1',
    unitId: 'u-1',
    kind: 'rent',
    title: 'Appartement S+2 Jardins de Carthage',
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
    ...NO_DETAILS,
    publishedAt: null,
    unitType: 'apartment',
    rooms: 3,
    surfaceM2: 98,
    floor: 2,
    unitStatus: 'vacant',
    city: 'Carthage',
    governorate: 'Tunis',
    latitude: null,
    longitude: null,
    coverFileId: null,
    photoCount: 0,
    photos: [],
    ...overrides,
  };
}

const photos = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ storageFileId: `file-${index + 1}`, position: index }));

function renderPage(listing: PublicListing, similar: PublicListing[] = []) {
  return render(
    <I18nProvider>
      <TooltipProvider>
        <ListingPageContent listing={listing} similar={similar} />
      </TooltipProvider>
    </I18nProvider>,
  );
}

/** Intl separators are narrow no-break spaces: compare with plain spaces. */
const flat = (node: HTMLElement) => (node.textContent ?? '').replace(/[\s  ]/g, ' ');

describe('ListingPageContent: conditions', () => {
  it('shows the rent deposit as months and amount (2 × 1450 = 2 900)', () => {
    const { container } = renderPage(makeListing({ price: 1450, depositMonths: 2 }));
    const conditions = screen.getByRole('region', { name: 'Conditions de location' });
    expect(flat(conditions)).toContain('2 mois');
    expect(flat(conditions)).toContain('2 900');
    expect(flat(conditions)).toContain('1 450');
    expect(flat(container)).not.toContain('Acompte de réservation');
  });

  it('shows the charges only when there are some, in the conditions and in the contact card', () => {
    const { rerender } = renderPage(makeListing({ charges: 80 }));
    expect(flat(screen.getByRole('region', { name: 'Conditions de location' }))).toContain('80,000');
    expect(flat(screen.getByRole('complementary'))).toContain('+ 80,000 TND de charges');

    rerender(
      <I18nProvider>
        <TooltipProvider>
          <ListingPageContent listing={makeListing({ charges: null })} similar={[]} />
        </TooltipProvider>
      </I18nProvider>,
    );
    expect(screen.queryByText(/de charges/)).not.toBeInTheDocument();
  });

  it('shows the availability date, or "immédiatement" without one', () => {
    const { rerender } = renderPage(makeListing({ availableFrom: '2026-11-01' }));
    expect(flat(screen.getByRole('region', { name: 'Conditions de location' }))).toContain('Disponible le 01/11/2026');
    rerender(
      <I18nProvider>
        <TooltipProvider>
          <ListingPageContent listing={makeListing({ availableFrom: null })} similar={[]} />
        </TooltipProvider>
      </I18nProvider>,
    );
    expect(flat(screen.getByRole('region', { name: 'Conditions de location' }))).toContain('Disponible immédiatement');
  });

  it('for a sale shows the price, the reservation deposit and its duration, and no documents list', () => {
    renderPage(makeListing({ kind: 'sale', price: 420000, reservationDeposit: 5000, reservationDays: 15, charges: 80 }));
    const conditions = screen.getByRole('region', { name: 'Conditions de vente' });
    expect(flat(conditions)).toContain('420 000');
    expect(flat(conditions)).toContain('Acompte de réservation');
    expect(flat(conditions)).toContain('5 000');
    expect(flat(conditions)).toContain('15 jours');
    expect(flat(conditions)).not.toContain('Dépôt de garantie');
    expect(screen.queryByRole('heading', { name: 'Documents demandés' })).not.toBeInTheDocument();
    expect(screen.queryByText('/ mois')).not.toBeInTheDocument();
  });

  it('for a rent lists the requested documents', () => {
    renderPage(makeListing());
    expect(screen.getByRole('heading', { level: 2, name: 'Documents demandés' })).toBeInTheDocument();
    expect(screen.getByText('Pièce d’identité')).toBeInTheDocument();
  });
});

describe('ListingPageContent: gallery', () => {
  it('shows the placeholder and no "Voir les" button when the listing has no photo', () => {
    renderPage(makeListing({ photos: [], coverFileId: null }));
    expect(screen.getByRole('img', { name: 'Photo non disponible' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Voir/ })).not.toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows a large photo, four thumbnails and « Voir les N photos », which opens the viewer on public urls', async () => {
    const user = userEvent.setup();
    renderPage(makeListing({ photos: photos(6), coverFileId: 'file-1', photoCount: 6 }));
    const gallery = screen.getByRole('region', { name: 'Photos du logement' });
    expect(gallery.querySelectorAll('img')).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: 'Voir les 6 photos' }));
    const dialog = await screen.findByRole('dialog');
    const viewed = within(dialog).getByRole('img');
    expect(viewed).toHaveAttribute('src', publicImageUrl('file-1', 1600));
    expect(within(dialog).getByText('1 / 6')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /Suivante/ }));
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', publicImageUrl('file-2', 1600));
    expect(within(dialog).getByRole('button', { name: 'Fermer' })).toBeInTheDocument();
  });

  it('a click on a thumbnail opens the viewer on that photo', async () => {
    const user = userEvent.setup();
    renderPage(makeListing({ photos: photos(3), coverFileId: 'file-1', photoCount: 3 }));
    await user.click(screen.getByRole('button', { name: 'Agrandir la photo 3 sur 3' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img')).toHaveAttribute('src', publicImageUrl('file-3', 1600));
  });

  it('a listing with a single photo has no thumbnails', () => {
    renderPage(makeListing({ photos: photos(1), coverFileId: 'file-1', photoCount: 1 }));
    expect(screen.getByRole('button', { name: 'Voir la photo' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Photos du logement' }).querySelectorAll('img')).toHaveLength(1);
  });
});

describe('ListingPageContent: virtual tour', () => {
  it('has no « Visite virtuelle » when there is no tour url', () => {
    renderPage(makeListing({ virtualTourUrl: null }));
    expect(screen.queryByText(/Visite virtuelle/)).not.toBeInTheDocument();
  });

  it('links to the tour in a new tab with noopener noreferrer', () => {
    renderPage(makeListing({ virtualTourUrl: 'https://tour.example.com/abc' }));
    const link = screen.getByRole('link', { name: /Visite virtuelle/ });
    expect(link).toHaveAttribute('href', 'https://tour.example.com/abc');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('ignores a tour url that is not http(s)', () => {
    renderPage(makeListing({ virtualTourUrl: 'javascript:alert(1)' }));
    expect(screen.queryByText(/Visite virtuelle/)).not.toBeInTheDocument();
    expect(safeTourUrl('javascript:alert(1)')).toBeNull();
    expect(safeTourUrl('data:text/html,hi')).toBeNull();
    expect(safeTourUrl('not a url')).toBeNull();
    expect(safeTourUrl('http://tour.example.com')).toBe('http://tour.example.com/');
    expect(safeTourUrl(null)).toBeNull();
  });
});

describe('ListingPageContent: booking card', () => {
  it('links the agency phone as tel: (digits and plus only) and the e-mail as mailto:', () => {
    renderPage(makeListing());
    const card = screen.getByRole('complementary');
    expect(within(card).getByRole('link', { name: /\+216 71 000 000/ })).toHaveAttribute('href', 'tel:+21671000000');
    expect(within(card).getByRole('link', { name: /contact@emerald-immobilier\.tn/ })).toHaveAttribute(
      'href',
      'mailto:contact@emerald-immobilier.tn',
    );
    expect(telHref('+216 (71) 000-000')).toBe('tel:+21671000000');
  });

  it('shows the price (left-to-right, per month for a rent) and both requests: rent and visit', () => {
    renderPage(makeListing());
    const card = screen.getByRole('complementary');
    const price = within(card).getByTestId('listing-price');
    expect(price).toHaveAttribute('dir', 'ltr');
    expect(flat(price)).toContain('1 450');
    expect(within(card).getByText('/ mois')).toBeInTheDocument();
    // Not signed in: CTAs render as links to the sign-in page, not as buttons.
    expect(within(card).getByRole('link', { name: 'Demander à louer' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Demander une visite' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Ajouter aux favoris' })).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Partager' })).toBeInTheDocument();
  });

  it('offers only a visit request for a unit for sale', () => {
    renderPage(makeListing({ kind: 'sale', price: 420000 }));
    const card = screen.getByRole('complementary');
    expect(within(card).queryByRole('button', { name: 'Demander à louer' })).not.toBeInTheDocument();
    // Not signed in: visit CTA renders as a link to sign-in.
    expect(within(card).getByRole('link', { name: 'Demander une visite' })).toBeInTheDocument();
  });

  it('shows a sale price without « / mois »', () => {
    renderPage(makeListing({ kind: 'sale', price: 420000 }));
    const card = screen.getByRole('complementary');
    expect(flat(within(card).getByTestId('listing-price'))).toContain('420 000');
    expect(within(card).queryByText('/ mois')).not.toBeInTheDocument();
  });
});

describe('ListingPageContent: header and details', () => {
  it('builds the breadcrumb from the search helpers', () => {
    renderPage(makeListing({ city: 'La Marsa' }));
    const nav = screen.getByRole('navigation', { name: 'Fil d’Ariane' });
    expect(within(nav).getByRole('link', { name: 'Accueil' })).toHaveAttribute('href', '/');
    expect(within(nav).getByRole('link', { name: 'Louer' })).toHaveAttribute('href', '/louer');
    expect(within(nav).getByRole('link', { name: 'La Marsa' })).toHaveAttribute('href', '/louer?ville=La+Marsa');
    expect(within(nav).getByText('Appartement S+2 Jardins de Carthage')).toHaveAttribute('aria-current', 'page');
  });

  it('uses Acheter for a sale and leaves the city out when there is none', () => {
    renderPage(makeListing({ kind: 'sale', city: null, governorate: null }));
    const nav = screen.getByRole('navigation', { name: 'Fil d’Ariane' });
    expect(within(nav).getByRole('link', { name: 'Acheter' })).toHaveAttribute('href', '/acheter');
    expect(within(nav).getAllByRole('link')).toHaveLength(2);
  });

  it('has one h1 (the title) and wraps a very long title instead of overflowing', () => {
    const title = 'Appartement'.repeat(30);
    renderPage(makeListing({ title }));
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(title);
    expect(heading.className).toContain('[overflow-wrap:anywhere]');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('survives every optional field being null', () => {
    renderPage(
      makeListing({
        city: null,
        governorate: null,
        floor: null,
        rooms: null,
        surfaceM2: null,
        latitude: null,
        longitude: null,
        description: null,
        charges: null,
        availableFrom: null,
      }),
    );
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Emplacement' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('listing-map')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Description' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Équipements' })).not.toBeInTheDocument();
  });

  it('keeps the line breaks of the description and renders it as plain text', () => {
    renderPage(makeListing({ description: 'Ligne 1\nLigne 2 <script>alert(1)</script>' }));
    const text = screen.getByText(/Ligne 1/);
    expect(text.className).toContain('whitespace-pre-line');
    expect(text.textContent).toBe('Ligne 1\nLigne 2 <script>alert(1)</script>');
    expect(document.querySelector('main script, [data-testid] script, p script')).toBeNull();
  });

  it('lists the amenities with their labels and the key facts', () => {
    renderPage(makeListing({ amenities: ['parking', 'lift', 'sea_view', 'unknown_thing'], furnished: true, floor: 0 }));
    const amenities = screen.getByRole('region', { name: 'Équipements' });
    expect(within(amenities).getByText('Parking')).toBeInTheDocument();
    expect(within(amenities).getByText('Ascenseur')).toBeInTheDocument();
    expect(within(amenities).getByText('Vue sur mer')).toBeInTheDocument();
    expect(within(amenities).getAllByRole('listitem')).toHaveLength(3);
    const facts = screen.getByRole('list', { name: 'Caractéristiques' });
    expect(flat(facts)).toContain('98 m²');
    expect(flat(facts)).toContain('3 pièces');
    expect(flat(facts)).toContain('Rez-de-chaussée');
    expect(flat(facts)).toContain('Meublé');
  });

  it('puts one pin on the map at the rounded coordinates', () => {
    renderPage(makeListing({ latitude: 36.85274, longitude: 10.32151 }));
    expect(screen.getByRole('heading', { level: 2, name: 'Emplacement' })).toBeInTheDocument();
    expect(screen.getByTestId('listing-map')).toBeInTheDocument();
    const { points } = mapProps.mock.calls[0][0] as { points: { lat: number; lon: number }[] };
    expect(points).toHaveLength(1);
    expect(points[0].lat).toBe(36.853);
    expect(points[0].lon).toBe(10.322);
  });
});

describe('ListingPageContent: similar listings', () => {
  it('shows the similar listings as cards', () => {
    const other = makeListing({ id: 'l-2', title: 'Studio voisin' });
    renderPage(makeListing(), [other]);
    const section = screen.getByRole('region', { name: 'Biens similaires à Carthage' });
    expect(within(section).getByRole('link', { name: 'Studio voisin' })).toHaveAttribute('href', '/logement/l-2');
  });

  it('hides the section when there is nothing similar', () => {
    renderPage(makeListing(), []);
    expect(screen.queryByText(/Biens similaires/)).not.toBeInTheDocument();
  });
});

describe('ListingPageContent: Arabic', () => {
  it('renders in Arabic with a left-to-right price', () => {
    setLocale('ar');
    renderPage(makeListing({ amenities: ['parking'], description: 'شقة مشمسة' }));
    expect(screen.getByRole('heading', { level: 2, name: 'الوصف' })).toBeInTheDocument();
    expect(within(screen.getByRole('complementary')).getByTestId('listing-price')).toHaveAttribute('dir', 'ltr');
  });
});
