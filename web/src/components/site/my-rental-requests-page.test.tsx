import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/components/auth-provider';
import { MyRentalRequestsPage } from './my-rental-requests-page';

const graphql = vi.hoisted(() => vi.fn());
vi.mock('@/lib/graphql', () => ({ graphql }));

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/compte/demandes' }));

const SESSION = { user: { displayName: 'Amine', email: 'amine@example.tn' }, accessToken: 'token' } as never;
const auth = (session: unknown) => ({
  session, ready: true, pendingPasswordChange: null, pendingMfa: null, completeMfa: vi.fn(), signIn: vi.fn(),
  completePasswordChange: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), confirmSignUp: vi.fn(),
}) as never;

const row = (id: string, status: string, over: Record<string, unknown> = {}) => ({
  id, unit_id: 'u1', start_date: '2026-11-01', duration_months: 12, status, closed_outcome: null, created_at: '2026-10-22T10:00:00Z', ...over,
});

function setup(rows: unknown[]) {
  graphql.mockImplementation(async (query: string) =>
    query.includes('MyRentalRequests')
      ? { rental_requests: rows }
      : { public_listings: [{ unit_id: 'u1', title: 'Appartement S+2', city: 'La Marsa', visit_fee: null, visit_payment_method: null, visit_payment_instructions: null }] },
  );
  return render(
    <AuthContext.Provider value={auth(SESSION)}>
      <MyRentalRequestsPage />
    </AuthContext.Provider>,
  );
}

describe('MyRentalRequestsPage', () => {
  beforeEach(() => {
    replace.mockClear();
    graphql.mockReset();
    graphql.mockResolvedValue({ rental_requests: [], public_listings: [] });
  });

  it('redirects to sign-in when signed out', () => {
    render(
      <AuthContext.Provider value={auth(null)}>
        <MyRentalRequestsPage />
      </AuthContext.Provider>,
    );
    expect(replace).toHaveBeenCalledWith('/compte/connexion');
  });

  it('shows each request with its listing, start date, length and a three-state status bar', async () => {
    setup([row('r1', 'contacted'), row('r2', 'accepted'), row('r3', 'declined'), row('r4', 'closed', { closed_outcome: 'accepted' })]);
    expect((await screen.findAllByText('Appartement S+2')).length).toBe(4);
    expect(screen.getAllByText(/01\/11\/2026/).length).toBe(4);
    expect(screen.getAllByRole('progressbar', { name: 'En attente' })).toHaveLength(1);
    expect(screen.getAllByRole('progressbar', { name: 'Acceptée' })).toHaveLength(2);
    expect(screen.getAllByRole('progressbar', { name: 'Refusée' })).toHaveLength(1);
    expect(screen.queryByText('Contactée')).not.toBeInTheDocument();
  });

  it('says so when there is no request yet', async () => {
    setup([]);
    expect(await screen.findByText('Aucune demande pour le moment')).toBeInTheDocument();
  });
});
