import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/components/auth-provider';
import { MESSAGES } from '@/i18n/messages';
import { ClientDashboard } from './client-dashboard';

const graphql = vi.hoisted(() => vi.fn());
vi.mock('@/lib/graphql', () => ({ graphql }));

const favoriteListingsAction = vi.hoisted(() => vi.fn());
vi.mock('@/lib/site/request-actions', () => ({ favoriteListingsAction }));

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/compte',
}));

const SESSION = { user: { displayName: 'Amine', email: 'amine@example.tn' }, accessToken: 'token' } as never;

function renderSignedIn(cities: string[] = ['Tunis', 'La Marsa']) {
  return render(
    <AuthContext.Provider
      value={{
        session: SESSION,
        ready: true,
        pendingPasswordChange: null,
  pendingMfa: null,
  completeMfa: vi.fn(),
        signIn: vi.fn(),
        completePasswordChange: vi.fn(),
        signOut: vi.fn(),
        signUp: vi.fn(),
        confirmSignUp: vi.fn(),
      }}
    >
      <ClientDashboard cities={cities} />
    </AuthContext.Provider>
  );
}

describe('ClientDashboard', () => {
  beforeEach(() => {
    replace.mockClear();
    graphql.mockReset();
    favoriteListingsAction.mockReset();

    graphql.mockImplementation(async (query: string) => {
      if (query.includes('MyVisitsCount')) {
        return { visit_requests: [{ id: 'v1' }, { id: 'v2' }] };
      }
      if (query.includes('MySavedSearches')) {
        return {
          saved_searches: [
            {
              id: 's1',
              label: 'Appartement à louer à Tunis',
              filters: JSON.stringify({ mode: 'rent', query: 'type=apartment&ville=Tunis' }),
              created_at: '2026-10-25T10:00:00Z',
            },
          ],
        };
      }
      if (query.includes('MyHiddenListings')) {
        return { hidden_listings: [{ listing_id: 'l-hidden-1', created_at: '2026-10-25T10:00:00Z' }] };
      }
      if (query.includes('MyRecentlyViewed')) {
        return { recently_viewed: [{ listing_id: 'l-viewed-1', viewed_at: '2026-10-26T12:00:00Z' }] };
      }
      if (query.includes('SaveSearch')) {
        return {
          insert_saved_searches_one: {
            id: 's-new',
            label: 'Bureau à acheter à La Marsa',
            filters: JSON.stringify({ mode: 'sale', query: 'type=office&ville=La+Marsa' }),
            created_at: '2026-10-29T10:00:00Z',
          },
        };
      }
      if (query.includes('UnhideListing')) {
        return { unhide_listing: { ok: true } };
      }
      if (query.includes('DeleteSavedSearch')) {
        return { delete_saved_searches: { affected_rows: 1 } };
      }
      return {};
    });

    favoriteListingsAction.mockImplementation(async (ids: string[]) => {
      return ids.map((id) => ({
        id,
        organizationId: 'org-1',
        unitId: `u-${id}`,
        kind: 'rent',
        title: `Titre pour ${id}`,
        description: null,
        price: 1500,
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
        surfaceM2: 100,
        floor: 1,
        unitStatus: 'vacant',
        city: 'Tunis',
        governorate: 'Tunis',
        latitude: null,
        longitude: null,
        coverFileId: null,
        photoCount: 0,
      }));
    });
  });

  it('redirects to sign-in when signed out', () => {
    render(
      <AuthContext.Provider
        value={{
          session: null,
          ready: true,
          pendingPasswordChange: null,
  pendingMfa: null,
  completeMfa: vi.fn(),
          signIn: vi.fn(),
          completePasswordChange: vi.fn(),
          signOut: vi.fn(),
          signUp: vi.fn(),
          confirmSignUp: vi.fn(),
        }}
      >
        <ClientDashboard />
      </AuthContext.Provider>
    );
    expect(replace).toHaveBeenCalledWith('/compte/connexion');
  });

  it('renders greeting with client name and profile link', async () => {
    renderSignedIn();
    expect(screen.getByText('Salut Amine')).toBeInTheDocument();
    const profileLink = screen.getByRole('link', { name: MESSAGES.fr.site.dashboard.profileCta });
    expect(profileLink).toHaveAttribute('href', '/compte/profil');
  });

  it('displays the 4 stat cards with values', async () => {
    renderSignedIn();
    expect(screen.getByText(MESSAGES.fr.site.dashboard.stats.favourites)).toBeInTheDocument();
    expect(screen.getByText(MESSAGES.fr.site.dashboard.stats.savedSearches)).toBeInTheDocument();
    expect(screen.getAllByText(MESSAGES.fr.site.dashboard.stats.hidden).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(MESSAGES.fr.site.dashboard.stats.visits)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // visits count
    });
  });

  it('shows saved searches and allows saving a new search', async () => {
    renderSignedIn();
    expect(await screen.findByText('Appartement à louer à Tunis')).toBeInTheDocument();

    // Fill the quick save search form
    fireEvent.click(screen.getByRole('button', { name: MESSAGES.fr.site.dashboard.saved.buy }));
    fireEvent.change(screen.getByLabelText(MESSAGES.fr.site.dashboard.saved.city), { target: { value: 'La Marsa' } });
    fireEvent.change(screen.getByLabelText(MESSAGES.fr.site.dashboard.saved.type), { target: { value: 'office' } });

    fireEvent.click(screen.getByRole('button', { name: MESSAGES.fr.site.dashboard.saved.submit }));

    await waitFor(() => {
      expect(screen.getByText(MESSAGES.fr.site.dashboard.saved.done)).toBeInTheDocument();
    });
  });

  it('displays hidden listings and allows unhiding them', async () => {
    renderSignedIn();
    expect(await screen.findByText('Titre pour l-hidden-1')).toBeInTheDocument();
    const unhideBtn = screen.getByRole('button', { name: MESSAGES.fr.site.dashboard.hidden.show });
    fireEvent.click(unhideBtn);
    await waitFor(() => {
      expect(graphql).toHaveBeenCalledWith(expect.stringContaining('UnhideListing'), { listing: 'l-hidden-1' });
    });
  });
});
