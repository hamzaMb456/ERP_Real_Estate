import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/components/auth-provider';
import { MyVisitsPage } from './my-visits-page';

const graphql = vi.hoisted(() => vi.fn());
vi.mock('@/lib/graphql', () => ({ graphql }));

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), usePathname: () => '/compte/visites' }));

const SESSION = { user: { displayName: 'Amine', email: 'amine@example.tn' }, accessToken: 'token' } as never;

function renderSignedIn() {
  return render(
    <AuthContext.Provider value={{ session: SESSION, ready: true, pendingPasswordChange: null, signIn: vi.fn(), completePasswordChange: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), confirmSignUp: vi.fn() }}>
      <MyVisitsPage />
    </AuthContext.Provider>,
  );
}

describe('MyVisitsPage', () => {
  beforeEach(() => {
    replace.mockClear();
    graphql.mockReset();
    graphql.mockImplementation(async (query: string) =>
      query.includes('MyVisits')
        ? { visit_requests: [{ id: 'v1', unit_id: 'u1', visit_date: '2026-11-02', visit_time: '10:30:00', status: 'confirmed', created_at: '2026-10-22T10:00:00Z' }] }
        : {
            public_listings: [
              {
                unit_id: 'u1',
                title: 'Appartement S+2',
                city: 'La Marsa',
                visit_fee: 30,
                visit_payment_method: 'virtual',
                visit_payment_instructions: 'Virement RIB TN59 ...',
              },
            ],
          },
    );
  });

  it('redirects to sign-in when signed out', () => {
    render(
      <AuthContext.Provider value={{ session: null, ready: true, pendingPasswordChange: null, signIn: vi.fn(), completePasswordChange: vi.fn(), signOut: vi.fn(), signUp: vi.fn(), confirmSignUp: vi.fn() }}>
        <MyVisitsPage />
      </AuthContext.Provider>,
    );
    expect(replace).toHaveBeenCalledWith('/compte/connexion');
  });

  it('shows the visit with its listing title, slot, fee and payment instructions when confirmed', async () => {
    renderSignedIn();
    expect(await screen.findByText('Appartement S+2')).toBeInTheDocument();
    expect(screen.getByText('02/11/2026 à 10:30')).toBeInTheDocument();
    expect(screen.getByText('Confirmée')).toBeInTheDocument();
    expect(screen.getByText(/Frais de visite/)).toBeInTheDocument();
    expect(screen.getByText(/Virement RIB TN59/)).toBeInTheDocument();
  });

  it('shows a fixed cash instruction for the manual payment method', async () => {
    graphql.mockImplementation(async (query: string) =>
      query.includes('MyVisits')
        ? { visit_requests: [{ id: 'v1', unit_id: 'u1', visit_date: '2026-11-02', visit_time: '10:30:00', status: 'confirmed', created_at: '2026-10-22T10:00:00Z' }] }
        : { public_listings: [{ unit_id: 'u1', title: 'Appartement S+2', city: 'La Marsa', visit_fee: null, visit_payment_method: 'manual', visit_payment_instructions: null }] },
    );
    renderSignedIn();
    expect(await screen.findByText('Réglez les frais en espèces directement à l’agent lors de la visite.')).toBeInTheDocument();
    expect(screen.queryByText(/Frais de visite/)).not.toBeInTheDocument();
  });
});
