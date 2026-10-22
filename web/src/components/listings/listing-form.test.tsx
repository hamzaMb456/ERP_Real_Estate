import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import type { ListingRecord } from '@/lib/listings';

const graphql = vi.fn();
vi.mock('@/lib/graphql', () => ({ graphql: (...args: unknown[]) => graphql(...args) }));

import { ListingForm } from './listing-form';

const fr = MESSAGES.fr;
const t = fr.listings;

const listing = (patch: Partial<ListingRecord> = {}): ListingRecord => ({
  id: 'L1',
  kind: 'rent',
  status: 'draft',
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

const renderForm = (record: ListingRecord, onSaved = vi.fn()) =>
  render(<ListingForm unitId="U1" kinds={['rent', 'sale']} listing={record} onSaved={onSaved} />);

beforeEach(() => {
  // Radix measures its checkboxes: jsdom has no ResizeObserver.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  graphql.mockReset();
  graphql.mockResolvedValue({});
});

describe('ListingForm', () => {
  it('shows the required-field message and sends nothing when the title is empty', async () => {
    renderForm(listing({ title: '' }));
    await userEvent.click(screen.getByRole('button', { name: t.form.save }));
    expect(await screen.findByText(fr.common.required)).toBeInTheDocument();
    expect(graphql).not.toHaveBeenCalled();
  });

  it('publishes with an update carrying status published', async () => {
    const onSaved = vi.fn();
    renderForm(listing(), onSaved);
    await userEvent.click(screen.getByRole('button', { name: t.form.publish }));
    await waitFor(() => expect(graphql).toHaveBeenCalledOnce());
    const [query, variables] = graphql.mock.calls[0] as [string, { id: string; set: Record<string, unknown> }];
    expect(query).toContain('update_listings_by_pk');
    expect(variables.id).toBe('L1');
    expect(variables.set).toMatchObject({ status: 'published', title: 'Appartement S+2', price: 1250 });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it('saves without touching the status of a published listing', async () => {
    renderForm(listing({ status: 'published' }));
    await userEvent.click(screen.getByRole('button', { name: t.form.save }));
    await waitFor(() => expect(graphql).toHaveBeenCalledOnce());
    expect((graphql.mock.calls[0][1] as { set: Record<string, unknown> }).set).not.toHaveProperty('status');
  });

  it('shows the catalog sentence of a publishing rule in an alert', async () => {
    graphql.mockRejectedValue(new Error('database query error: LISTING_NEEDS_PHOTO'));
    const onSaved = vi.fn();
    renderForm(listing(), onSaved);
    await userEvent.click(screen.getByRole('button', { name: t.form.publish }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.needsPhoto);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('hides the rent-only fields and shows the reservation fields for a sale listing', () => {
    renderForm(listing({ kind: 'sale' }));
    expect(screen.queryByLabelText(t.form.charges)).toBeNull();
    expect(screen.queryByLabelText(t.form.depositMonths)).toBeNull();
    expect(screen.getByLabelText(t.form.reservationDeposit)).toBeInTheDocument();
    expect(screen.getByLabelText(t.form.reservationDays)).toBeInTheDocument();
    expect(screen.getByLabelText(t.form.priceSale)).toBeInTheDocument();
  });

  it('shows the rent fields for a rent listing', () => {
    renderForm(listing());
    expect(screen.getByLabelText(t.form.priceRent)).toBeInTheDocument();
    expect(screen.getByLabelText(t.form.charges)).toBeInTheDocument();
    expect(screen.getByLabelText(t.form.depositMonths)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.form.reservationDeposit)).toBeNull();
  });

  it('offers pause on a published listing and close on any open one, but never reopens', () => {
    const { unmount } = renderForm(listing({ status: 'published' }));
    expect(screen.getByRole('button', { name: t.form.pause })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.form.close })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.card.viewOnSite })).toHaveAttribute('href', '/logement/L1');
    unmount();
    renderForm(listing({ status: 'draft' }));
    expect(screen.queryByRole('button', { name: t.form.pause })).toBeNull();
    expect(screen.queryByRole('link', { name: t.card.viewOnSite })).toBeNull();
  });

  it('closes after confirmation with the manual reason', async () => {
    renderForm(listing({ status: 'paused' }));
    await userEvent.click(screen.getByRole('button', { name: t.form.close }));
    await userEvent.click(await screen.findByRole('button', { name: t.form.closeConfirm }));
    await waitFor(() => expect(graphql).toHaveBeenCalledOnce());
    expect((graphql.mock.calls[0][1] as { set: unknown }).set).toEqual({ status: 'closed', closed_reason: 'manual' });
  });

  it('creates a listing with an insert when no listing is given', async () => {
    render(<ListingForm unitId="U1" kinds={['rent']} onSaved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(t.form.title), 'Studio meublé');
    await userEvent.click(screen.getByRole('button', { name: t.form.save }));
    await waitFor(() => expect(graphql).toHaveBeenCalledOnce());
    const [query, variables] = graphql.mock.calls[0] as [string, { object: Record<string, unknown> }];
    expect(query).toContain('insert_listings_one');
    expect(variables.object).toMatchObject({ unit_id: 'U1', kind: 'rent', status: 'draft', title: 'Studio meublé' });
  });
});
