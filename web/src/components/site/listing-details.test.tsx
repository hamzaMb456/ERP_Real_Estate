import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider } from '@/i18n/provider';
import { setLocale } from '@/i18n/store';
import { NO_DETAILS, type ListingDetails } from '@/lib/site/listing-details';
import type { PublicListing } from '@/lib/site/listings-queries';
import { ListingConditions, ListingFeatures, ListingNeighbourhood } from './listing-details';
import { ListingHeader } from './listing-header';

afterEach(() => setLocale('fr'));

function makeListing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'l-1',
    organizationId: 'org-1',
    unitId: 'u-1',
    kind: 'rent',
    title: 'Appartement S+2',
    description: null,
    price: 1450,
    charges: null,
    depositMonths: 2,
    reservationDeposit: 10000,
    reservationDays: 15,
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
    ...overrides,
  };
}

const details = (overrides: Partial<ListingDetails>): Partial<PublicListing> => overrides;

function show(listing: PublicListing, ...parts: ('features' | 'neighbourhood' | 'conditions' | 'header')[]) {
  return render(
    <I18nProvider>
      <TooltipProvider>
        {parts.includes('header') && <ListingHeader listing={listing} />}
        {parts.includes('features') && <ListingFeatures listing={listing} />}
        {parts.includes('neighbourhood') && <ListingNeighbourhood listing={listing} />}
        {parts.includes('conditions') && <ListingConditions listing={listing} />}
      </TooltipProvider>
    </I18nProvider>,
  );
}

const flat = (node: HTMLElement) => (node.textContent ?? '').replace(/[\s  ]/g, ' ');

describe('ListingFeatures', () => {
  it('renders nothing when no detail is filled', () => {
    const { container } = show(makeListing(), 'features');
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the condition, year, floors, balcony, garden, orientation and energy class, each outdoor space on its own line', () => {
    show(
      makeListing(
        details({ propertyCondition: 'good', yearBuilt: 2018, floorsCount: 6, balconyM2: 12.5, gardenM2: 40, orientation: ['south', 'east'], energyClass: 'C' }),
      ),
      'features',
    );
    const section = screen.getByRole('region', { name: 'Caractéristiques détaillées' });
    const text = flat(section);
    expect(text).toContain('Bon état');
    expect(text).toContain('2018');
    expect(text).toContain('Étages de l’immeuble6');
    expect(text).toContain('Balcon12,5');
    expect(text).toContain('Jardin40');
    expect(text).not.toContain('Terrasse');
    expect(text).toContain('Sud · Est');
    expect(text).toContain('Classe énergétique');
  });

  it('ignores a condition or an energy class the catalog does not know', () => {
    const { container } = show(makeListing(details({ propertyCondition: 'haunted', energyClass: 'Z' })), 'features');
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ListingNeighbourhood', () => {
  it('shows the text of the bien, and nothing when it is empty', () => {
    const { unmount } = show(makeListing(details({ neighbourhoodDescription: 'Rue calme près de la plage.' })), 'neighbourhood');
    expect(screen.getByRole('region', { name: 'Le quartier' })).toHaveTextContent('Rue calme près de la plage.');
    unmount();
    const { container } = show(makeListing(), 'neighbourhood');
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ListingConditions: lease terms and legal status', () => {
  it('shows the minimum lease, the pets rule and the included charges of a rental', () => {
    show(makeListing(details({ minLeaseMonths: 12, petsAllowed: true, chargesIncluded: ['water', 'syndic', 'tv'] })), 'conditions');
    const text = flat(screen.getByRole('region', { name: 'Conditions de location' }));
    expect(text).toContain('Durée minimale du bail12 mois');
    expect(text).toContain('AnimauxAcceptés');
    expect(text).toContain('Eau · Syndic');
    expect(text).not.toContain('tv');
  });

  it('shows a refused-pets rule, and nothing when pets are not specified', () => {
    const { unmount } = show(makeListing(details({ petsAllowed: false })), 'conditions');
    expect(flat(screen.getByRole('region', { name: 'Conditions de location' }))).toContain('AnimauxRefusés');
    unmount();
    show(makeListing(), 'conditions');
    expect(screen.queryByText('Animaux')).not.toBeInTheDocument();
    expect(screen.queryByText('Durée minimale du bail')).not.toBeInTheDocument();
  });

  it('shows the legal status of a sale with its label', () => {
    show(makeListing({ kind: 'sale', ...details({ legalStatus: 'collective_title' }) }), 'conditions');
    expect(flat(screen.getByRole('region', { name: 'Conditions de vente' }))).toContain('Titre foncier collectif');
  });
});

describe('ListingHeader: new facts', () => {
  it('shows bedrooms, bathrooms, parking and the floor out of the total', () => {
    show(makeListing({ floor: 2, ...details({ bedrooms: 3, bathrooms: 2, parkingSpaces: 1, floorsCount: 6 }) }), 'header');
    const facts = flat(screen.getByRole('list', { name: 'Caractéristiques' }));
    expect(facts).toContain('3 chambres');
    expect(facts).toContain('2 salles de bain');
    expect(facts).toContain('1 place de parking');
    expect(facts).toContain('Étage 2 sur 6');
  });

  it('keeps the plain floor when the building has no floor count, and hides empty counts', () => {
    show(makeListing({ floor: 2, ...details({ bedrooms: 0 }) }), 'header');
    const facts = flat(screen.getByRole('list', { name: 'Caractéristiques' }));
    expect(facts).toContain('Étage 2');
    expect(facts).not.toContain('sur');
    expect(facts).not.toContain('chambre');
  });
});
