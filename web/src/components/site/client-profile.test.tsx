import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/components/auth-provider';
import { MESSAGES } from '@/i18n/messages';
import { ClientProfile } from './client-profile';

const replace = vi.fn();
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/compte/profil',
}));

const SESSION = { user: { displayName: 'Amine', email: 'amine@example.tn' }, accessToken: 'token' } as never;
const signOut = vi.fn();

function renderSignedIn() {
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
        signOut,
        signUp: vi.fn(),
        confirmSignUp: vi.fn(),
      }}
    >
      <ClientProfile />
    </AuthContext.Provider>
  );
}

describe('ClientProfile', () => {
  beforeEach(() => {
    replace.mockClear();
    push.mockClear();
    signOut.mockClear();
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
          signOut,
          signUp: vi.fn(),
          confirmSignUp: vi.fn(),
        }}
      >
        <ClientProfile />
      </AuthContext.Provider>
    );
    expect(replace).toHaveBeenCalledWith('/compte/connexion');
  });

  it('displays the user name and email', () => {
    renderSignedIn();
    expect(screen.getByText('Amine')).toBeInTheDocument();
    expect(screen.getByText('amine@example.tn')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: MESSAGES.fr.site.profile.back })).toHaveAttribute('href', '/compte');
    expect(screen.getByRole('link', { name: MESSAGES.fr.site.profile.changePassword })).toHaveAttribute(
      'href',
      '/compte/mot-de-passe-oublie'
    );
  });

  it('signs out and navigates to home when clicking logout button', async () => {
    renderSignedIn();
    const logoutBtn = screen.getByRole('button', { name: MESSAGES.fr.site.profile.logout });
    fireEvent.click(logoutBtn);
    expect(signOut).toHaveBeenCalled();
  });
});
