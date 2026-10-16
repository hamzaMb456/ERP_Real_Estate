import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedRow } from '@/lib/appointment-types';
import type { StaffOption } from './calendar-types';
import { AppointmentDialog } from './appointment-dialog';

// The dialog never talks to a server in these tests: units load empty, saving succeeds.
vi.mock('@/lib/graphql', () => ({
  graphql: vi.fn(async (query: string) => (query.includes('mutation') ? { insert_appointments_one: { id: 'new' } } : { units: [] })),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const STAFF: StaffOption[] = [{ user_id: 'u1', display_name: 'Karim Trabelsi', email: 'karim@example.tn', role: 'manager' }];

const BUSY: FeedRow = {
  event_id: 'a:busy',
  organization_id: 'o1',
  source: 'appointment',
  kind: 'meeting',
  title: 'Réunion fournisseur',
  starts_at: '2026-10-16T08:00:00+00:00',
  ends_at: '2026-10-16T09:00:00+00:00',
  all_day: false,
  status: 'planned',
  appointment_id: 'busy',
  lease_id: null,
  unit_id: null,
  branch_id: null,
  assigned_user_id: 'u1',
  contact_ids: [],
  location: null,
  notify_by_email: true,
};

const baseProps = { open: true, onOpenChange: () => {}, existing: [] as FeedRow[], staff: STAFF, contacts: [] };

describe('AppointmentDialog', () => {
  beforeEach(() => {
    // Radix measures its checkbox and selects: jsdom has neither ResizeObserver nor pointer capture.
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
  });

  it('asks for a title and does not save without one', async () => {
    const onSaved = vi.fn();
    render(<AppointmentDialog {...baseProps} initial={{ startsAt: '2026-10-16T09:00:00+01:00' }} onSaved={onSaved} />);
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('Le titre est obligatoire.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('refuses an end that does not follow the start', async () => {
    const onSaved = vi.fn();
    render(<AppointmentDialog {...baseProps} initial={{ startsAt: '2026-10-16T09:00:00+01:00' }} onSaved={onSaved} />);
    await userEvent.type(screen.getByLabelText('Titre *'), 'Visite B-101');
    fireEvent.change(screen.getByLabelText('Durée (minutes) *'), { target: { value: '-30' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(await screen.findByText('La date de fin doit suivre la date de début.')).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('warns about a staff overlap but still lets the appointment be saved', async () => {
    const onSaved = vi.fn();
    render(
      <AppointmentDialog
        {...baseProps}
        existing={[BUSY]}
        initial={{ startsAt: '2026-10-16T09:30:00+01:00', assignedUserId: 'u1' }}
        onSaved={onSaved}
      />,
    );
    expect(await screen.findByText('Ce collaborateur a déjà un rendez-vous à cette heure.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Titre *'), 'Visite B-101');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
  });

  it('does not warn when the same collaborator is free', async () => {
    render(
      <AppointmentDialog {...baseProps} existing={[BUSY]} initial={{ startsAt: '2026-10-16T11:00:00+01:00', assignedUserId: 'u1' }} onSaved={() => {}} />,
    );
    expect(screen.queryByText('Ce collaborateur a déjà un rendez-vous à cette heure.')).toBeNull();
  });

  it('notifies by e-mail by default', () => {
    render(<AppointmentDialog {...baseProps} onSaved={() => {}} />);
    expect(screen.getByRole('checkbox', { name: 'Prévenir par e-mail' })).toBeChecked();
  });
});
