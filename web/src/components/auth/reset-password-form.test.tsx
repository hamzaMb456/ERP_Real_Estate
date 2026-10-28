import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError } from '@/lib/auth/session';
import { ResetPasswordForm } from './reset-password-form';

const requestPasswordReset = vi.hoisted(() => vi.fn());
const confirmPasswordReset = vi.hoisted(() => vi.fn());
vi.mock('@/lib/auth/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session')>()),
  requestPasswordReset,
  confirmPasswordReset,
}));

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

async function askForCode(email = 'amine@example.tn') {
  const user = userEvent.setup();
  render(<ResetPasswordForm signInPath="/compte/connexion" variant="site" />);
  await user.type(screen.getByLabelText('Adresse e-mail'), email);
  await user.click(screen.getByRole('button', { name: 'Envoyer le code' }));
  return user;
}

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    replace.mockClear();
    requestPasswordReset.mockReset().mockResolvedValue(undefined);
    confirmPasswordReset.mockReset().mockResolvedValue(undefined);
  });

  it('refuses a malformed address without calling the server', async () => {
    await askForCode('not-an-email');

    expect(await screen.findByText('Adresse e-mail non valide.')).toBeInTheDocument();
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it('asks for a code, then shows the second step with the address', async () => {
    await askForCode();

    expect(requestPasswordReset).toHaveBeenCalledWith('amine@example.tn');
    expect(await screen.findByLabelText('Code à 6 chiffres')).toBeInTheDocument();
    expect(screen.getByText(/amine@example\.tn/)).toBeInTheDocument();
  });

  it('sets the new password and returns to sign-in with the success flag', async () => {
    const user = await askForCode();
    await user.type(await screen.findByLabelText('Code à 6 chiffres'), '123456');
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'Abcdef12');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'Abcdef12');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

    await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalledWith('amine@example.tn', '123456', 'Abcdef12'));
    expect(replace).toHaveBeenCalledWith('/compte/connexion?reset=1');
  });

  it('blocks a weak or mismatched password before calling the server', async () => {
    const user = await askForCode();
    await user.type(await screen.findByLabelText('Code à 6 chiffres'), '123456');
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'abc');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'abd');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

    expect(await screen.findByText('Les deux mots de passe ne correspondent pas.')).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the server wording for a wrong code and stays on the page', async () => {
    confirmPasswordReset.mockRejectedValue(new AuthError('CodeMismatchException'));
    const user = await askForCode();
    await user.type(await screen.findByLabelText('Code à 6 chiffres'), '000000');
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'Abcdef12');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'Abcdef12');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

    expect(await screen.findByText(/Ce code n’est pas le bon/)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends the code again and says so', async () => {
    const user = await askForCode();
    await user.click(await screen.findByRole('button', { name: 'Renvoyer le code' }));

    expect(await screen.findByText('Un nouveau code vient d’être envoyé.')).toBeInTheDocument();
    expect(requestPasswordReset).toHaveBeenCalledTimes(2);
  });

  it('goes back to the e-mail step to use another address', async () => {
    const user = await askForCode();
    await user.click(await screen.findByRole('button', { name: 'Changer d’adresse e-mail' }));

    expect(await screen.findByRole('button', { name: 'Envoyer le code' })).toBeInTheDocument();
  });
});
