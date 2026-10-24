import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/provider';
import { MESSAGES } from '@/i18n/messages';
import { addDays, todayTunis } from '@/lib/dates';
import { resetFavoritesCache } from '@/lib/site/favorites';
import { NO_DETAILS } from '@/lib/site/listing-details';
import type { PublicListing } from '@/lib/site/listings-queries';
import { visitDays } from '@/lib/site/request-form';
import { FavoritesPage } from './favorites-page';
import { quickFilters } from './quick-filters';
import { RequestDialog } from './request-dialog';
import { ShareButton, whatsappHref } from './share-button';

const actions = vi.hoisted(() => ({
  submitRentalRequestAction: vi.fn(),
  submitVisitRequestAction: vi.fn(),
  takenVisitSlotsAction: vi.fn(),
  favoriteListingsAction: vi.fn(),
}));
vi.mock('@/lib/site/request-actions', () => actions);

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/' }));

const ID = '70712abb-68cb-41d4-a655-598b41e43b2a';
const LISTING: PublicListing = {
  id: ID,
  organizationId: 'org-1',
  unitId: ID,
  kind: 'rent',
  title: 'Appartement S+2 lumineux',
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
  surfaceM2: 80,
  floor: 2,
  unitStatus: 'vacant',
  city: 'Tunis',
  governorate: null,
  latitude: null,
  longitude: null,
  coverFileId: null,
  photoCount: 0,
  ...NO_DETAILS,
};

const renderDialog = (kind: 'rent' | 'visit') =>
  render(
    <I18nProvider>
      <RequestDialog kind={kind} listing={LISTING} open onOpenChange={() => {}} />
    </I18nProvider>,
  );

async function fillContact() {
  await userEvent.type(screen.getByLabelText('Nom et prénom'), 'Amine Ben Salah');
  await userEvent.type(screen.getByLabelText('Téléphone'), '+216 20 111 222');
}

beforeEach(() => {
  Object.values(actions).forEach((action) => action.mockReset());
  actions.takenVisitSlotsAction.mockResolvedValue([]);
  actions.favoriteListingsAction.mockResolvedValue([]);
  window.localStorage.clear();
  resetFavoritesCache();
});

describe('RequestDialog: rental request', () => {
  it('asks for the missing fields and sends nothing', async () => {
    renderDialog('rent');
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(screen.getAllByText('Ce champ est obligatoire').length).toBeGreaterThanOrEqual(3);
    expect(actions.submitRentalRequestAction).not.toHaveBeenCalled();
  });

  it('sends the start date, the duration and the contact, then thanks the visitor', async () => {
    actions.submitRentalRequestAction.mockResolvedValue({ ok: true });
    renderDialog('rent');
    const start = addDays(todayTunis(), 7);
    fireEvent.change(screen.getByLabelText('Date d’entrée souhaitée'), { target: { value: start } });
    await userEvent.click(screen.getByRole('button', { name: '24 mois' }));
    await fillContact();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));

    await waitFor(() =>
      expect(actions.submitRentalRequestAction).toHaveBeenCalledWith(
        expect.objectContaining({ unitId: ID, startDate: start, months: 24, fullName: 'Amine Ben Salah', phone: '+216 20 111 222', website: '' }),
      ),
    );
    expect(await screen.findByText('Demande envoyée')).toBeInTheDocument();
    expect(screen.getByText(/Merci Amine Ben Salah/)).toBeInTheDocument();
  });

  it('takes a custom duration in months', async () => {
    actions.submitRentalRequestAction.mockResolvedValue({ ok: true });
    renderDialog('rent');
    fireEvent.change(screen.getByLabelText('Date d’entrée souhaitée'), { target: { value: todayTunis() } });
    await userEvent.type(screen.getByLabelText('Autre durée (en mois)'), '18');
    await fillContact();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => expect(actions.submitRentalRequestAction).toHaveBeenCalledWith(expect.objectContaining({ months: 18 })));
  });

  it('words a refusal of the server and keeps the form', async () => {
    actions.submitRentalRequestAction.mockResolvedValue({ ok: false, code: 'too_many' });
    renderDialog('rent');
    fireEvent.change(screen.getByLabelText('Date d’entrée souhaitée'), { target: { value: todayTunis() } });
    await fillContact();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de demandes en peu de temps');
    expect(screen.getByLabelText('Nom et prénom')).toHaveValue('Amine Ben Salah');
  });

  it('passes the honeypot through so the server can drop a bot', async () => {
    actions.submitRentalRequestAction.mockResolvedValue({ ok: true });
    renderDialog('rent');
    fireEvent.change(screen.getByLabelText('Date d’entrée souhaitée'), { target: { value: todayTunis() } });
    await fillContact();
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'http://spam.example' } });
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() => expect(actions.submitRentalRequestAction).toHaveBeenCalledWith(expect.objectContaining({ website: 'http://spam.example' })));
  });
});

describe('RequestDialog: visit request', () => {
  it('offers the bookable days and greys out the slots already taken on the chosen day', async () => {
    const day = visitDays()[0];
    actions.takenVisitSlotsAction.mockResolvedValue([{ date: day, time: '10:30' }]);
    renderDialog('visit');
    expect(actions.takenVisitSlotsAction).toHaveBeenCalledWith(ID);
    const days = screen.getByRole('group', { name: 'Jour' });
    await userEvent.click(within(days).getAllByRole('button')[0]);
    const slots = screen.getByRole('group', { name: 'Créneau' });
    await waitFor(() => expect(within(slots).getByRole('button', { name: '10:30' })).toBeDisabled());
    expect(within(slots).getByRole('button', { name: '10:00' })).toBeEnabled();
    expect(within(slots).getAllByRole('button')).toHaveLength(18);
  });

  it('sends the day, the slot and the contact', async () => {
    actions.submitVisitRequestAction.mockResolvedValue({ ok: true });
    const day = visitDays()[0];
    renderDialog('visit');
    await userEvent.click(within(screen.getByRole('group', { name: 'Jour' })).getAllByRole('button')[0]);
    await userEvent.click(within(screen.getByRole('group', { name: 'Créneau' })).getByRole('button', { name: '14:30' }));
    await fillContact();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    await waitFor(() =>
      expect(actions.submitVisitRequestAction).toHaveBeenCalledWith(expect.objectContaining({ unitId: ID, date: day, time: '14:30', fullName: 'Amine Ben Salah' })),
    );
    expect(await screen.findByText('Demande envoyée')).toBeInTheDocument();
  });

  it('marks a slot taken meanwhile and asks for another', async () => {
    actions.submitVisitRequestAction.mockResolvedValue({ ok: false, code: 'slot_taken' });
    renderDialog('visit');
    await userEvent.click(within(screen.getByRole('group', { name: 'Jour' })).getAllByRole('button')[0]);
    await userEvent.click(within(screen.getByRole('group', { name: 'Créneau' })).getByRole('button', { name: '09:00' }));
    await fillContact();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce créneau vient d’être pris');
    expect(within(screen.getByRole('group', { name: 'Créneau' })).getByRole('button', { name: '09:00' })).toBeDisabled();
  });

  it('asks for a day and a slot first', async () => {
    renderDialog('visit');
    await fillContact();
    await userEvent.click(screen.getByRole('button', { name: 'Envoyer la demande' }));
    expect(actions.submitVisitRequestAction).not.toHaveBeenCalled();
    expect(screen.getAllByText('Ce champ est obligatoire')).toHaveLength(2);
  });
});

describe('quickFilters', () => {
  const labels = MESSAGES.fr.site.quick;
  const base = { cities: [], types: [], sort: 'recent' as const, page: 3 };

  it('switches one filter on and back to page 1', () => {
    const chips = quickFilters(base, labels, '2026-10-23');
    expect(chips.map((chip) => chip.label)).toEqual(['Meublé', '2 pièces et +', '3 pièces et +', '4 pièces et +', 'Disponible maintenant']);
    expect(chips[0].next).toMatchObject({ furnished: true, page: 1 });
    expect(chips[2].next).toMatchObject({ roomsMin: 3, page: 1 });
    expect(chips[4].next).toMatchObject({ availableFrom: '2026-10-23', page: 1 });
  });

  it('switches an active chip off, and one room count replaces another', () => {
    const chips = quickFilters({ ...base, furnished: true, roomsMin: 3 }, labels, '2026-10-23');
    expect(chips[0].active).toBe(true);
    expect(chips[0].next.furnished).toBeUndefined();
    expect(chips[2].active).toBe(true);
    expect(chips[2].next.roomsMin).toBeUndefined();
    expect(chips[3].next.roomsMin).toBe(4);
  });
});

describe('ShareButton', () => {
  it('builds a WhatsApp link with the message and the address', () => {
    const href = whatsappHref('Regarde cette annonce : Studio', 'https://example.tn/logement/1');
    expect(href).toBe('https://wa.me/?text=' + encodeURIComponent('Regarde cette annonce : Studio https://example.tn/logement/1'));
  });

  it('copies the link of the listing', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(window.navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(
      <I18nProvider>
        <ShareButton listingId={ID} title="Studio" />
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Partager' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Copier le lien' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/logement/${ID}`);
    expect(await screen.findByText('Lien copié')).toBeInTheDocument();
  });
});

describe('FavoritesPage', () => {
  it('invites to browse when nothing is hearted', () => {
    render(
      <I18nProvider>
        <FavoritesPage />
      </I18nProvider>,
    );
    expect(screen.getByText('Aucun favori pour le moment')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir les annonces' })).toHaveAttribute('href', '/louer');
    expect(actions.favoriteListingsAction).not.toHaveBeenCalled();
  });

  it('loads the hearted listings by id and shows them', async () => {
    window.localStorage.setItem('emerald.favorites.v1', JSON.stringify([ID]));
    resetFavoritesCache();
    actions.favoriteListingsAction.mockResolvedValue([LISTING]);
    render(
      <I18nProvider>
        <FavoritesPage />
      </I18nProvider>,
    );
    expect(await screen.findByRole('link', { name: 'Appartement S+2 lumineux' })).toHaveAttribute('href', `/logement/${ID}`);
    expect(actions.favoriteListingsAction).toHaveBeenCalledWith([ID]);
    expect(screen.getByText('1 logement')).toBeInTheDocument();
  });
});
