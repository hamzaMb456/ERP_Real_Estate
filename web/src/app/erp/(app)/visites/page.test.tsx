import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VisitsPage from './page';

const graphql = vi.hoisted(() => vi.fn());
vi.mock('@/lib/graphql', () => ({ graphql }));
vi.mock('@/lib/use-can-edit', () => ({ useCanEdit: () => true }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const UNIT = { id: 'u1', code: 'B-102', title: null, property: { id: 'p1', name: 'Les Jardins de Carthage', city: 'Carthage' } };
const base = { phone: '71 000 111', email: null, message: null, staff_note: null, unit: UNIT, visit_date: '2026-11-02', visit_time: '10:30:00' };
const REQUESTS = [
  { ...base, id: 'v1', full_name: 'Amine Ben Salah', created_at: '2026-10-22T10:00:00Z', status: 'new', appointment_id: null },
  { ...base, id: 'v2', full_name: 'Sana Gharbi', created_at: '2026-10-20T10:00:00Z', status: 'confirmed', appointment_id: 'a2' },
];

describe('/erp/visites', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    graphql.mockReset();
    graphql.mockImplementation(async (query: string) => (query.includes('mutation') ? { ok: true } : { visit_requests: REQUESTS }));
  });

  it('shows the slot of each visit', async () => {
    render(<VisitsPage />);
    await screen.findByText('Amine Ben Salah');
    expect(screen.getAllByText('02/11/2026 à 10:30')).toHaveLength(2);
  });

  it('confirms a visit by booking a half-hour viewing in Tunisia time and marking the request, in one request', async () => {
    render(<VisitsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmer la visite' }));
    await waitFor(() => {
      const call = graphql.mock.calls.find(([query]) => String(query).includes('ConfirmVisit'));
      expect(call).toBeDefined();
      const variables = call![1] as { id: string; appointmentId: string; appointment: Record<string, unknown> };
      expect(variables.id).toBe('v1');
      expect(variables.appointment).toMatchObject({
        id: variables.appointmentId,
        kind: 'viewing',
        title: 'Visite B-102 · Les Jardins de Carthage - Amine Ben Salah',
        starts_at: '2026-11-02T10:30:00+01:00',
        ends_at: '2026-11-02T10:00:00.000Z',
        unit_id: 'u1',
        notify_by_email: false,
      });
    });
  });

  it('explains a slot that another confirmed visit already holds', async () => {
    graphql.mockImplementation(async (query: string) => {
      if (query.includes('ConfirmVisit')) throw new Error('Uniqueness violation. duplicate key value violates unique constraint "visit_requests_one_confirmed_slot"');
      return { visit_requests: REQUESTS };
    });
    render(<VisitsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmer la visite' }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Modification impossible', {
        description: 'Une autre visite est déjà confirmée sur ce créneau pour cette unité.',
      }),
    );
  });

  it('completes a confirmed visit and its calendar appointment together', async () => {
    render(<VisitsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Marquer effectuée' }));
    await waitFor(() =>
      expect(graphql).toHaveBeenCalledWith(expect.stringContaining('CloseVisit'), {
        id: 'v2',
        status: 'done',
        appointmentId: 'a2',
        appointmentStatus: 'done',
      }),
    );
  });
});
