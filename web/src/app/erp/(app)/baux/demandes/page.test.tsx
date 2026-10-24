import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RentalRequestsPage from './page';

const graphql = vi.hoisted(() => vi.fn());
vi.mock('@/lib/graphql', () => ({ graphql }));
vi.mock('@/lib/use-can-edit', () => ({ useCanEdit: () => true }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const UNIT = { id: 'u1', code: 'B-102', title: null, property: { id: 'p1', name: 'Les Jardins de Carthage', city: 'Carthage' } };
const base = { phone: '+216 20 111 222', email: 'amine@example.tn', message: 'Disponible rapidement.', staff_note: null, unit: UNIT, duration_months: 12 };
const REQUESTS = [
  { ...base, id: 'r1', full_name: 'Amine Ben Salah', created_at: '2026-10-22T10:00:00Z', start_date: '2026-11-01', status: 'new' },
  { ...base, id: 'r2', full_name: 'Sana Gharbi', created_at: '2026-10-20T10:00:00Z', start_date: '2026-12-01', status: 'accepted', email: null, message: null },
];

describe('/erp/baux/demandes', () => {
  beforeEach(() => {
    graphql.mockReset();
    graphql.mockImplementation(async (query: string) => (query.includes('mutation') ? { ok: true } : { rental_requests: REQUESTS }));
  });

  it('lists the requests newest first with their unit, start date and duration', async () => {
    render(<RentalRequestsPage />);
    const headings = await screen.findAllByRole('heading', { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(['Amine Ben Salah', 'Sana Gharbi']);
    expect(screen.getAllByText('B-102 · Les Jardins de Carthage')).toHaveLength(2);
    expect(screen.getAllByText('12 mois').length).toBeGreaterThan(0);
    expect(screen.getByText('Disponible rapidement.')).toBeInTheDocument();
  });

  it('offers a call link and writes only when there is an e-mail', async () => {
    render(<RentalRequestsPage />);
    await screen.findByText('Amine Ben Salah');
    expect(screen.getAllByRole('link', { name: /Appeler/ })[0]).toHaveAttribute('href', 'tel:+21620111222');
    expect(screen.getAllByRole('link', { name: /Écrire à/ })).toHaveLength(1);
  });

  it('marks a request contacted with one status update', async () => {
    render(<RentalRequestsPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Marquer contactée' }));
    await waitFor(() =>
      expect(graphql).toHaveBeenCalledWith(expect.stringContaining('update_rental_requests_by_pk'), { id: 'r1', set: { status: 'contacted' } }),
    );
  });

  it('links an accepted request to a new lease for its unit', async () => {
    render(<RentalRequestsPage />);
    expect(await screen.findByRole('link', { name: 'Créer un bail' })).toHaveAttribute('href', '/erp/baux/nouveau?unite=u1');
  });

  it('filters by status chip and by search', async () => {
    render(<RentalRequestsPage />);
    await screen.findByText('Amine Ben Salah');
    await userEvent.click(screen.getByRole('radio', { name: /Acceptée/ }));
    expect(screen.queryByText('Amine Ben Salah')).not.toBeInTheDocument();
    expect(screen.getByText('Sana Gharbi')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Toutes/ }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Rechercher' }), 'zzz');
    expect(await screen.findByText('Aucune demande ne correspond')).toBeInTheDocument();
  });

  it('says so when no request has arrived', async () => {
    graphql.mockResolvedValue({ rental_requests: [] });
    render(<RentalRequestsPage />);
    expect(await screen.findByText('Aucune demande de location pour le moment')).toBeInTheDocument();
  });
});
