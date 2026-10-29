import { fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/' }));
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider } from '@/i18n/provider';
import { setLocale } from '@/i18n/store';
import { MESSAGES } from '@/i18n/messages';
import type { PublicListing } from '@/lib/site/listings-queries';
import { ListingCard } from './listing-card';

function makeListing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'l-1',
    organizationId: 'org-1',
    unitId: 'u-1',
    kind: 'rent',
    title: 'Appartement S+2 lumineux près du centre',
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
    city: 'La Marsa',
    governorate: 'Tunis',
    latitude: null,
    longitude: null,
    coverFileId: 'file-1',
    photoCount: 3,
    ...overrides,
  } as PublicListing;
}

function renderCard(listing: PublicListing) {
  return render(
    <TooltipProvider>
      <ListingCard listing={listing} />
    </TooltipProvider>,
  );
}

const text = (node: HTMLElement) => (node.textContent ?? '').replace(/[\s  ]/g, ' ');

afterEach(() => setLocale('fr'));

describe('ListingCard', () => {
  it('shows the rent with the monthly suffix, in a tabular left-to-right price', () => {
    renderCard(makeListing());
    const price = screen.getByTestId('listing-price');
    expect(text(price)).toContain('1 450');
    expect(price).toHaveClass('tabular-nums');
    expect(price).toHaveAttribute('dir', 'ltr');
    expect(screen.getByText('/ mois')).toBeInTheDocument();
  });

  it('shows a sale price without the monthly suffix', () => {
    renderCard(makeListing({ kind: 'sale', price: 420000 }));
    const price = screen.getByTestId('listing-price');
    expect(text(price)).toContain('420 000');
    expect(screen.queryByText('/ mois')).not.toBeInTheDocument();
  });

  it('clamps the title to two lines and links the whole card to the listing page', () => {
    renderCard(makeListing());
    const title = screen.getByRole('heading', { name: 'Appartement S+2 lumineux près du centre' });
    expect(title).toHaveClass('line-clamp-2');
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/logement/l-1');
    expect(link).toHaveTextContent('Appartement S+2 lumineux près du centre');
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders a lazy cover photo built from the storage file id', () => {
    renderCard(makeListing());
    const img = screen.getByRole('img', { name: /Appartement S\+2/ });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img.getAttribute('src')).toContain('/property-files/file-1');
    expect(img).toHaveClass('object-cover');
  });

  it('renders the catalog placeholder instead of an image when there is no cover', () => {
    const { container } = renderCard(makeListing({ coverFileId: null }));
    expect(container.querySelector('img')).toBeNull();
    const placeholder = screen.getByRole('img', { name: MESSAGES.fr.site.listingCard.noPhoto });
    expect(placeholder.tagName).not.toBe('IMG');
  });

  it('falls back to the placeholder when the photo fails to load', () => {
    const { container } = renderCard(makeListing());
    fireEvent.error(container.querySelector('img') as HTMLImageElement);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: MESSAGES.fr.site.listingCard.noPhoto })).toBeInTheDocument();
  });

  it('shows city, surface, rooms and floor, and skips what is missing', () => {
    const { rerender } = renderCard(makeListing());
    expect(screen.getByText('La Marsa')).toBeInTheDocument();
    expect(text(screen.getByTestId('listing-specs'))).toContain('92 m²');
    expect(screen.getByTestId('listing-specs')).toHaveTextContent('3 pièces');
    expect(screen.getByTestId('listing-specs')).toHaveTextContent('Étage 2');

    rerender(
      <TooltipProvider>
        <ListingCard listing={makeListing({ city: null, floor: null, rooms: null, surfaceM2: null })} />
      </TooltipProvider>,
    );
    expect(screen.queryByText('La Marsa')).not.toBeInTheDocument();
    expect(screen.queryByTestId('listing-city')).not.toBeInTheDocument();
    expect(screen.queryByTestId('listing-specs')).not.toBeInTheDocument();
  });

  it('shows « Disponible » unless the availability date is in the future', () => {
    const { rerender } = renderCard(makeListing({ availableFrom: '2020-01-01' }));
    expect(screen.getByText('Disponible')).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <ListingCard listing={makeListing({ availableFrom: '2999-03-05' })} />
      </TooltipProvider>,
    );
    expect(screen.queryByText('Disponible')).not.toBeInTheDocument();
    expect(screen.getByText(/^Dès le 05\/03\/2999$/)).toBeInTheDocument();
  });

  it('prerenders a dated listing as « Dès le <date> » without reading the clock', () => {
    const html = renderToString(
      <TooltipProvider>
        <ListingCard listing={makeListing({ availableFrom: '2020-01-01' })} />
      </TooltipProvider>,
    );
    expect(html).toContain('Dès le 01/01/2020');
    expect(html).not.toContain('>Disponible<');
  });

  it('has a hide toggle outside the link that redirects to sign-in when not authenticated', () => {
    renderCard(makeListing());
    const hideBtn = screen.getByRole('button', { name: MESSAGES.fr.site.listingCard.hide });
    expect(hideBtn).toHaveAttribute('aria-pressed', 'false');
    expect(hideBtn.closest('a')).toBeNull();
    fireEvent.click(hideBtn);
    expect(push).toHaveBeenCalledWith('/compte/connexion');
  });

  it('has a live favourite toggle outside the link', () => {
    renderCard(makeListing());
    const heart = screen.getByRole('button', { name: MESSAGES.fr.site.booking.favouriteAdd });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    expect(heart.closest('a')).toBeNull();
    // Not signed in: clicking redirects to sign-in instead of toggling.
    fireEvent.click(heart);
    expect(push).toHaveBeenCalledWith('/compte/connexion');
    // Button stays in the « add » state (no toggle without auth).
    expect(screen.getByRole('button', { name: MESSAGES.fr.site.booking.favouriteAdd })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the visit fee badge only when it is set and positive', () => {
    const { rerender } = renderCard(makeListing({ visitFee: 50 }));
    expect(screen.getByTestId('listing-visit-fee')).toHaveTextContent('Visite : 50');

    rerender(
      <TooltipProvider>
        <ListingCard listing={makeListing({ visitFee: null })} />
      </TooltipProvider>,
    );
    expect(screen.queryByTestId('listing-visit-fee')).not.toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <ListingCard listing={makeListing({ visitFee: 0 })} />
      </TooltipProvider>,
    );
    expect(screen.queryByTestId('listing-visit-fee')).not.toBeInTheDocument();
  });

  it('uses the Arabic catalog', () => {
    setLocale('ar');
    render(
      <I18nProvider>
        <TooltipProvider>
          <ListingCard listing={makeListing({ coverFileId: null })} />
        </TooltipProvider>
      </I18nProvider>,
    );
    expect(screen.getByRole('img', { name: MESSAGES.ar.site.listingCard.noPhoto })).toBeInTheDocument();
    expect(MESSAGES.ar.site.listingCard.noPhoto).not.toBe(MESSAGES.fr.site.listingCard.noPhoto);
  });
});
