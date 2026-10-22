import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryState } from '@/lib/use-graphql';

const useGraphql = vi.fn();
vi.mock('@/lib/use-graphql', () => ({ useGraphql: (...args: unknown[]) => useGraphql(...args) }));

import { ContactAppointments } from './contact-appointments';

type Participation = {
  role: string;
  email_status: string;
  appointment: {
    id: string;
    title: string;
    kind: string;
    status: string;
    starts_at: string;
    ends_at: string;
    location: string | null;
    unit_id: string | null;
    lease_id: string | null;
  };
};

const participation = (id: string, patch: Partial<Participation['appointment']> = {}): Participation => ({
  role: 'renter',
  email_status: 'sent',
  appointment: {
    id,
    title: `RDV ${id}`,
    kind: 'viewing',
    status: 'planned',
    starts_at: '2026-11-02T09:00:00+01:00',
    ends_at: '2026-11-02T10:00:00+01:00',
    location: null,
    unit_id: null,
    lease_id: null,
    ...patch,
  },
});

const success = (rows: Participation[]): QueryState<unknown> => ({ status: 'success', data: { appointment_participants: rows } });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T12:00:00+01:00'));
  useGraphql.mockReset();
});

afterEach(() => vi.useRealTimers());

describe('ContactAppointments', () => {
  it('asks the server for the contact’s own participations instead of the whole organization', () => {
    useGraphql.mockReturnValue(success([]));
    render(<ContactAppointments contactId="C1" />);
    expect(useGraphql).toHaveBeenCalled();
    for (const [query, variables] of useGraphql.mock.calls as [string, Record<string, unknown>][]) {
      expect(query).toContain('appointment_participants');
      expect(query).toContain('contact_id: { _eq: $contactId }');
      expect(query).not.toContain('calendar_feed');
      expect(variables).toEqual({ contactId: 'C1' });
    }
  });

  it('splits upcoming and past appointments and marks cancelled and done ones', () => {
    useGraphql.mockReturnValue(
      success([
        participation('later', { title: 'Visite B-102', starts_at: '2026-11-20T09:00:00+01:00', ends_at: '2026-11-20T10:00:00+01:00' }),
        participation('soon', { title: 'Remise des clés', starts_at: '2026-10-20T09:00:00+01:00', ends_at: '2026-10-20T10:00:00+01:00' }),
        participation('cancelled-future', { title: 'Réunion annulée', status: 'cancelled', starts_at: '2026-10-25T09:00:00+01:00', ends_at: '2026-10-25T10:00:00+01:00' }),
        participation('old', { title: 'État des lieux', status: 'done', starts_at: '2026-09-01T09:00:00+01:00', ends_at: '2026-09-01T10:00:00+01:00' }),
      ]),
    );
    render(<ContactAppointments contactId="C1" />);

    const upcoming = within(screen.getByRole('heading', { name: 'À venir' }).closest('section') as HTMLElement);
    const past = within(screen.getByRole('heading', { name: 'Passés' }).closest('section') as HTMLElement);

    const upcomingTitles = upcoming.getAllByRole('link').map((link) => link.textContent);
    expect(upcomingTitles).toEqual(['Remise des clés', 'Visite B-102']);
    expect(upcoming.queryByText('Annulé')).not.toBeInTheDocument();

    const pastTitles = past.getAllByRole('link').map((link) => link.textContent);
    expect(pastTitles).toEqual(expect.arrayContaining(['Réunion annulée', 'État des lieux']));
    expect(past.getByText('Annulé')).toBeInTheDocument();
    expect(past.getByText('Fait')).toBeInTheDocument();
  });

  it('links each appointment to its sheet on the calendar, on the right day', () => {
    useGraphql.mockReturnValue(success([participation('A7', { title: 'Visite B-102', starts_at: '2026-11-02T09:00:00+01:00' })]));
    render(<ContactAppointments contactId="C1" />);
    expect(screen.getByRole('link', { name: 'Visite B-102' })).toHaveAttribute('href', '/erp/calendrier?rendezvous=A7&date=2026-11-02');
  });

  it('shows the empty messages when the contact has no appointment', () => {
    useGraphql.mockReturnValue(success([]));
    render(<ContactAppointments contactId="C1" />);
    expect(screen.getByText('Aucun rendez-vous à venir.')).toBeInTheDocument();
    expect(screen.getByText('Aucun rendez-vous passé.')).toBeInTheDocument();
  });

  it('shows the loading state and the error message', () => {
    useGraphql.mockReturnValue({ status: 'loading' });
    const { rerender } = render(<ContactAppointments contactId="C1" />);
    expect(screen.getByText('Chargement des rendez-vous…')).toBeInTheDocument();
    useGraphql.mockReturnValue({ status: 'error', message: 'boom' });
    rerender(<ContactAppointments contactId="C1" />);
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });
});
