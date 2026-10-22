import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MESSAGES } from '@/i18n/messages';
import { I18nProvider } from '@/i18n/provider';
import { setLocale } from '@/i18n/store';
import type { PublicListing } from '@/lib/site/listings-queries';
import { HomeHero } from './home-hero';
import { HomeListingsSection, HomeStats, HowItWorks, SandBand } from './home-sections';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

// Radix Select needs a few browser APIs that jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => push.mockReset());
afterEach(() => setLocale('fr'));

const CITIES = ['Carthage', 'La Marsa', 'Tunis'];

function makeListing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'l-1',
    organizationId: 'org-1',
    unitId: 'u-1',
    kind: 'rent',
    title: 'Appartement S+2 à Carthage',
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

const text = (node: HTMLElement) => (node.textContent ?? '').replace(/[\s  ]/g, ' ');

describe('HomeHero', () => {
  it('shows the h1 and defaults to the rent mode', () => {
    render(<HomeHero cities={CITIES} />);
    expect(screen.getByRole('heading', { level: 1, name: MESSAGES.fr.site.home.hero.title })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Louer' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Acheter' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sends the buy search with city and budget to /acheter', async () => {
    const user = userEvent.setup();
    render(<HomeHero cities={CITIES} />);
    await user.click(screen.getByRole('button', { name: 'Acheter' }));
    await user.click(screen.getByRole('combobox', { name: 'Ville' }));
    await user.click(await screen.findByRole('option', { name: 'La Marsa' }));
    await user.type(screen.getByRole('textbox', { name: /Budget max/ }), '400000');
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(push).toHaveBeenCalledWith('/acheter?ville=La+Marsa&prix_max=400000');
  });

  it('adds the property type and sends a rent search to /louer', async () => {
    const user = userEvent.setup();
    render(<HomeHero cities={CITIES} />);
    await user.click(screen.getByRole('combobox', { name: 'Type de bien' }));
    await user.click(await screen.findByRole('option', { name: 'Bureau' }));
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(push).toHaveBeenCalledWith('/louer?type=office');
  });

  it('goes to the bare listing page, without "?", when nothing is filled in', async () => {
    const user = userEvent.setup();
    render(<HomeHero cities={CITIES} />);
    await user.click(screen.getByRole('button', { name: 'Rechercher' }));
    expect(push).toHaveBeenCalledWith('/louer');
  });

  it('submits with Enter from the budget field and accepts a spaced amount', async () => {
    const user = userEvent.setup();
    render(<HomeHero cities={CITIES} />);
    await user.type(screen.getByRole('textbox', { name: /Budget max/ }), '2 500{Enter}');
    expect(push).toHaveBeenCalledWith('/louer?prix_max=2500');
  });

  it('ignores a budget that is not a number', async () => {
    const user = userEvent.setup();
    render(<HomeHero cities={CITIES} />);
    await user.type(screen.getByRole('textbox', { name: /Budget max/ }), 'abc{Enter}');
    expect(push).toHaveBeenCalledWith('/louer');
  });

  it('offers « Toutes les villes » plus the published cities', async () => {
    const user = userEvent.setup();
    render(<HomeHero cities={CITIES} />);
    await user.click(screen.getByRole('combobox', { name: 'Ville' }));
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent);
    expect(options).toEqual(['Toutes les villes', ...CITIES]);
  });

  it('is translated in Arabic', () => {
    setLocale('ar');
    render(
      <I18nProvider>
        <HomeHero cities={CITIES} />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: MESSAGES.ar.site.home.hero.title })).toBeInTheDocument();
  });
});

describe('HomeStats', () => {
  it('shows the published count first, then the cities and the two promises', () => {
    render(<HomeStats total={128} cities={9} />);
    const cards = screen.getAllByRole('listitem');
    expect(cards).toHaveLength(4);
    expect(text(cards[0])).toContain('128');
    expect(text(cards[0])).toContain(MESSAGES.fr.site.home.stats.listings);
    expect(text(cards[1])).toContain('9');
    expect(text(cards[2])).toContain('Visite sous 48 h');
    expect(text(cards[3])).toContain('Dossier 100 % en ligne');
  });
});

describe('HomeListingsSection', () => {
  const renderSection = (kind: 'rent' | 'sale', listings: PublicListing[]) =>
    render(
      <TooltipProvider>
        <HomeListingsSection kind={kind} listings={listings} />
      </TooltipProvider>,
    );

  it('shows the empty text, not cards, when there is no rent listing', () => {
    renderSection('rent', []);
    expect(screen.getByRole('heading', { level: 2, name: 'Nouveautés à la location' })).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.fr.site.home.rent.empty)).toBeInTheDocument();
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });

  it('lists the cards and links to the full list', () => {
    renderSection('rent', [makeListing(), makeListing({ id: 'l-2', title: 'Studio meublé' })]);
    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.queryByText(MESSAGES.fr.site.home.rent.empty)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir toutes les locations/ })).toHaveAttribute('href', '/louer');
  });

  it('is the « À vendre » section, linking to /acheter', () => {
    renderSection('sale', []);
    expect(screen.getByRole('heading', { level: 2, name: 'À vendre' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voir tous les biens à vendre/ })).toHaveAttribute('href', '/acheter');
  });
});

describe('HowItWorks and SandBand', () => {
  it('exposes the #comment-ca-marche anchor with four steps', () => {
    const { container } = render(<HowItWorks />);
    const section = container.querySelector('#comment-ca-marche') as HTMLElement;
    expect(section).not.toBeNull();
    expect(within(section).getByRole('heading', { level: 2, name: 'Comment ça marche' })).toBeInTheDocument();
    expect(within(section).getAllByRole('listitem')).toHaveLength(4);
  });

  it('closes with a call to action towards the contact block', () => {
    render(<SandBand />);
    expect(screen.getByRole('link', { name: MESSAGES.fr.site.home.band.cta })).toHaveAttribute('href', '/#contact');
  });
});
