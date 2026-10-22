import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import type { ListingRecord } from '@/lib/listings';

let canEdit = true;
let rows: ListingRecord[] = [];
vi.mock('@/lib/use-can-edit', () => ({ useCanEdit: () => canEdit }));
vi.mock('@/lib/use-graphql', () => ({ useGraphql: () => ({ status: 'success', data: { listings: rows } }) }));
vi.mock('@/lib/graphql', () => ({ graphql: vi.fn() }));

import { ListingCardErp } from './listing-card-erp';

const t = MESSAGES.fr.listings;

const row = (patch: Partial<ListingRecord> = {}): ListingRecord => ({
  id: 'L1',
  kind: 'rent',
  status: 'published',
  title: 'Appartement S+2',
  description: null,
  price: 1250,
  charges: null,
  deposit_months: 2,
  reservation_deposit: 10000,
  reservation_days: 15,
  available_from: null,
  furnished: false,
  amenities: [],
  virtual_tour_url: null,
  ...patch,
});

beforeEach(() => {
  canEdit = true;
  rows = [];
});

describe('ListingCardErp', () => {
  it('offers to create a listing when the unit has none', () => {
    render(<ListingCardErp unitId="U1" unitStatus="vacant" />);
    expect(screen.getByText(t.card.none)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.card.create })).toBeInTheDocument();
  });

  it('hides the creation button from a viewer', () => {
    canEdit = false;
    render(<ListingCardErp unitId="U1" unitStatus="vacant" />);
    expect(screen.queryByRole('button', { name: t.card.create })).toBeNull();
  });

  it('explains why a sold unit cannot be listed', () => {
    render(<ListingCardErp unitId="U1" unitStatus="sold" />);
    expect(screen.getByText(t.card.noKinds)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.card.create })).toBeNull();
  });

  it('shows the open listing with its status, and no creation for a kind that already has one', () => {
    rows = [row()];
    render(<ListingCardErp unitId="U1" unitStatus="vacant" />);
    expect(screen.getByText('Appartement S+2')).toBeInTheDocument();
    expect(screen.getByText(t.statuses.published)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.card.create })).toBeNull();
  });

  it('still offers a sale listing next to a rent one on a rented unit', () => {
    rows = [row({ status: 'draft' })];
    render(<ListingCardErp unitId="U1" unitStatus="rented" />);
    expect(screen.getByRole('button', { name: t.card.create })).toBeInTheDocument();
  });

  it('gives a viewer the link to the public page of a published listing', () => {
    canEdit = false;
    rows = [row()];
    render(<ListingCardErp unitId="U1" unitStatus="vacant" />);
    expect(screen.getByRole('link', { name: t.card.viewOnSite })).toHaveAttribute('href', '/logement/L1');
  });
});
