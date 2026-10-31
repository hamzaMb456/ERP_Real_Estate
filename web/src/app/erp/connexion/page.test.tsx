import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams() }));

const auth = {
  session: null as unknown,
  ready: true,
  pendingPasswordChange: null as unknown,
  pendingMfa: null as unknown,
  signIn: vi.fn(),
  completePasswordChange: vi.fn(),
  completeMfa: vi.fn(),
};
vi.mock('@/components/auth-provider', () => ({ useAuth: () => auth }));

import ConnexionPage from './page';

beforeEach(() => {
  replace.mockReset();
  auth.session = null;
  auth.pendingPasswordChange = null;
  auth.pendingMfa = null;
  auth.signIn.mockReset();
  auth.completeMfa.mockReset();
});

describe('ERP sign-in page', () => {
  it('asks for email and password first', () => {
    render(<ConnexionPage />);
    expect(screen.getByLabelText('Adresse e-mail professionnelle')).toBeInTheDocument();
    expect(screen.queryByLabelText('Code à 6 chiffres')).not.toBeInTheDocument();
  });

  it('asks for the authenticator code when the sign-in needs one', () => {
    auth.pendingMfa = { email: 'amel@agence.tn', challengeSession: 's', challengeUserId: 'u' };
    render(<ConnexionPage />);
    expect(screen.getByLabelText('Code à 6 chiffres')).toBeInTheDocument();
    expect(screen.queryByLabelText('Adresse e-mail professionnelle')).not.toBeInTheDocument();
  });

  it('sends the code and moves on', async () => {
    const user = userEvent.setup();
    auth.pendingMfa = { email: 'amel@agence.tn', challengeSession: 's', challengeUserId: 'u' };
    auth.completeMfa.mockResolvedValue(undefined);
    render(<ConnexionPage />);
    await user.type(screen.getByLabelText('Code à 6 chiffres'), '123456');
    await user.click(screen.getByRole('button', { name: 'Valider le code' }));
    expect(auth.completeMfa).toHaveBeenCalledWith('123456');
    expect(replace).toHaveBeenCalled();
  });

  it('shows the message and stays when the code is wrong', async () => {
    const user = userEvent.setup();
    auth.pendingMfa = { email: 'amel@agence.tn', challengeSession: 's', challengeUserId: 'u' };
    auth.completeMfa.mockRejectedValue(new Error('Code incorrect.'));
    render(<ConnexionPage />);
    await user.type(screen.getByLabelText('Code à 6 chiffres'), '000000');
    await user.click(screen.getByRole('button', { name: 'Valider le code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Code incorrect.');
    expect(replace).not.toHaveBeenCalled();
  });
});
