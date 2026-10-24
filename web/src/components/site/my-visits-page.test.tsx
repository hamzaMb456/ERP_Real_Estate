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
    <AuthContext.Provider value={{ session: SESSION, ready: true, signIn: vi.fn(), signOut: vi.fn(), signUp: vi.fn() }}>
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
        : { public_listings: [{ unit_id: 'u1', title: 'Appartement S+2', city: 'La Marsa', visit_payment_method: 'virtual' }] },
    );
  });

  it('redirects to sign-in when signed out', () => {
    render(
      <AuthContext.Provider value={{ session: null, ready: true, signIn: vi.fn(), signOut: vi.fn(), signUp: vi.fn() }}>
        <MyVisitsPage />
      </AuthContext.Provider>,
    );
    expect(replace).toHaveBeenCalledWith('/compte/connexion');
  });

  it('shows the visit with its listing title, slot and payment method when confirmed', async () => {
    renderSignedIn();
    expect(await screen.findByText('Appartement S+2')).toBeInTheDocument();
    expect(screen.getByText('02/11/2026 à 10:30')).toBeInTheDocument();
    expect(screen.getByText('Confirmée')).toBeInTheDocument();
    expect(screen.getByText('Paiement : virtuel')).toBeInTheDocument();
  });
});
