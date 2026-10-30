import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/components/auth-provider';
import { setLocale } from '@/i18n/store';
import type { PublicListing } from '@/lib/site/listings-queries';
import { ListingBookingCard } from './listing-booking-card';

vi.mock('next/navigation', () => ({ usePathname: () => '/logement/u-1', useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const graphql = vi.hoisted(() => vi.fn());
vi.mock('@/lib/graphql', () => ({ graphql }));

const submitRentalRequestAction = vi.hoisted(() => vi.fn());
const submitVisitRequestAction = vi.hoisted(() => vi.fn());
vi.mock('@/lib/site/request-actions', () => ({
  submitRentalRequestAction,
  submitVisitRequestAction,
  takenVisitSlotsAction: vi.fn().mockResolvedValue([]),
}));

const SESSION = { user: { displayName: 'Amine', email: 'amine@example.tn' }, accessToken: 'token' } as never;

function makeListing(overrides: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 'u-1', organizationId: 'org-1', unitId: 'u-1', kind: 'rent', title: 'Appartement S+2', description: null,
    price: 1450, charges: null, depositMonths: 2, reservationDeposit: 0, reservationDays: 0, availableFrom: null,
    furnished: false, amenities: [], virtualTourUrl: null, publishedAt: null, unitType: 'apartment', rooms: 3,
    surfaceM2: 92, floor: 2, unitStatus: 'vacant', city: 'La Marsa', governorate: 'Tunis', latitude: null,
    longitude: null, coverFileId: 'file-1', photoCount: 3,
    ...overrides,
  } as PublicListing;
}

function renderSignedIn(listing: PublicListing) {
  render(
    <AuthContext.Provider value={{ session: SESSION, ready: true, pendingPasswordChange: null,
  pendingMfa: null,
  completeMfa: vi.fn(), signIn: vi.fn(), completePasswordChange: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), confirmSignUp: vi.fn() }}>
      <ListingBookingCard listing={listing} />
    </AuthContext.Provider>,
  );
  // The mobile sticky bar duplicates the visit button outside the card; scope queries to the main card only.
  return within(screen.getByRole('complementary'));
}

describe('ListingBookingCard', () => {
  beforeEach(() => {
    graphql.mockReset().mockResolvedValue({ has_rental_request: false, has_visit_request: false });
    submitRentalRequestAction.mockReset().mockResolvedValue({ ok: true });
    submitVisitRequestAction.mockReset().mockResolvedValue({ ok: true });
  });

  afterEach(() => setLocale('fr'));

  it('starts with both buttons enabled when the client has no prior request', async () => {
    const card = renderSignedIn(makeListing());
    expect(await card.findByRole('button', { name: 'Demander à louer' })).toBeEnabled();
    expect(card.getByRole('button', { name: /Demander une visite/ })).toBeEnabled();
  });

  it('disables only the visit button once the client already has a visit request', async () => {
    graphql.mockResolvedValue({ has_rental_request: false, has_visit_request: true });
    const card = renderSignedIn(makeListing());
    expect(await card.findByRole('button', { name: /Demander une visite/ })).toBeDisabled();
    expect(card.getByRole('button', { name: 'Demander à louer' })).toBeEnabled();
    expect(card.getByText('Vous avez déjà envoyé une demande de visite pour ce bien.')).toBeInTheDocument();
  });

  it('disables both buttons once the client already has a rental request', async () => {
    graphql.mockResolvedValue({ has_rental_request: true, has_visit_request: false });
    const card = renderSignedIn(makeListing());
    expect(await card.findByRole('button', { name: 'Demander à louer' })).toBeDisabled();
    expect(card.getByRole('button', { name: /Demander une visite/ })).toBeDisabled();
    expect(card.getByText('Vous avez déjà envoyé une demande de location pour ce bien.')).toBeInTheDocument();
  });

  it('disables only the visit button right after sending a visit request, rent stays open', async () => {
    const user = userEvent.setup();
    const card = renderSignedIn(makeListing());
    await user.click(await card.findByRole('button', { name: /Demander une visite/ }));
    // The dialog renders in a portal, outside the card: find its fields on the whole document.
    await screen.findByText('Jour');
    await user.click(screen.getAllByRole('button', { name: /lun\.|mar\.|mer\.|jeu\.|ven\.|sam\.|dim\./ })[0]);
    await user.click(await screen.findByRole('button', { name: '09:00' }));
    await user.type(screen.getByRole('textbox', { name: 'Nom et prénom' }), 'Sami Jebali');
    await user.type(screen.getByRole('textbox', { name: 'Téléphone' }), '71123456');
    await user.click(screen.getByRole('button', { name: 'Envoyer la demande' }));

    await waitFor(() => expect(submitVisitRequestAction).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: 'Fermer' }));

    expect(card.getByRole('button', { name: /Demander une visite/ })).toBeDisabled();
    expect(card.getByRole('button', { name: 'Demander à louer' })).toBeEnabled();
  });

  it('disables both buttons right after sending a rental request', async () => {
    const user = userEvent.setup();
    const card = renderSignedIn(makeListing());
    await user.click(await card.findByRole('button', { name: 'Demander à louer' }));
    await user.type(screen.getByLabelText('Date d’entrée souhaitée'), '2026-12-01');
    await user.type(screen.getByRole('textbox', { name: 'Nom et prénom' }), 'Sami Jebali');
    await user.type(screen.getByRole('textbox', { name: 'Téléphone' }), '71123456');
    await user.click(screen.getByRole('button', { name: 'Envoyer la demande' }));

    await waitFor(() => expect(submitRentalRequestAction).toHaveBeenCalled());
    await user.click(await screen.findByRole('button', { name: 'Fermer' }));

    expect(card.getByRole('button', { name: 'Demander à louer' })).toBeDisabled();
    expect(card.getByRole('button', { name: /Demander une visite/ })).toBeDisabled();
  });

  it('does not offer a rent button for a listing that is for sale', async () => {
    const card = renderSignedIn(makeListing({ kind: 'sale', price: 250000, charges: null }));
    expect(card.queryByRole('button', { name: 'Demander à louer' })).not.toBeInTheDocument();
    expect(await card.findByRole('button', { name: /Demander une visite/ })).toBeEnabled();
  });
});
