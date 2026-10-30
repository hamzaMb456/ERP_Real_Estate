import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async () => 'data:image/png;base64,QR') } }));

import { ActivationFlow } from './activation-flow';

const fetchMock = vi.fn();
const reply = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status });
const sentActions = (): string[] => fetchMock.mock.calls.map(([, init]) => (JSON.parse((init as RequestInit).body as string) as { action: string }).action);

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

async function reachAuthenticatorStep(user: ReturnType<typeof userEvent.setup>) {
  fetchMock
    .mockResolvedValueOnce(reply({ email: 'amel@agence.tn', name: 'Amel' }))
    .mockResolvedValueOnce(reply({ setupKey: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/x?secret=JBSWY3DPEHPK3PXP', accessToken: 'access-1' }));
  render(<ActivationFlow token="inv-1.sig" />);
  await screen.findByText(/Amel/);
  await user.type(screen.getByLabelText('Mot de passe', { exact: true }), 'Strong-pass-1');
  await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'Strong-pass-1');
  await user.click(screen.getByRole('button', { name: 'Continuer' }));
}

describe('ActivationFlow', () => {
  it('shows the invalid-link message when the link is refused', async () => {
    fetchMock.mockResolvedValueOnce(reply({ error: 'invalid-invitation' }, 400));
    render(<ActivationFlow token="bad" />);
    expect(await screen.findByText(/n’est plus valable/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Mot de passe', { exact: true })).not.toBeInTheDocument();
  });

  it('refuses a weak password before calling the server', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply({ email: 'amel@agence.tn', name: 'Amel' }));
    render(<ActivationFlow token="inv-1.sig" />);
    await screen.findByText(/Amel/);
    await user.type(screen.getByLabelText('Mot de passe', { exact: true }), 'weak');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'weak');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText(/Au moins 8 caractères/)).toBeInTheDocument();
    expect(sentActions()).toEqual(['check']);
  });

  it('refuses two different passwords before calling the server', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValueOnce(reply({ email: 'amel@agence.tn', name: 'Amel' }));
    render(<ActivationFlow token="inv-1.sig" />);
    await screen.findByText(/Amel/);
    await user.type(screen.getByLabelText('Mot de passe', { exact: true }), 'Strong-pass-1');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'Strong-pass-2');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText(/ne correspondent pas/)).toBeInTheDocument();
    expect(sentActions()).toEqual(['check']);
  });

  it('moves from the password to the authenticator step and shows the setup key and the QR code', async () => {
    const user = userEvent.setup();
    await reachAuthenticatorStep(user);
    expect(await screen.findByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByAltText('QR')).toHaveAttribute('src', 'data:image/png;base64,QR'));
    expect(sentActions()).toEqual(['check', 'setpassword']);
  });

  it('a wrong code shows a message and stays on the step', async () => {
    const user = userEvent.setup();
    await reachAuthenticatorStep(user);
    fetchMock.mockResolvedValueOnce(reply({ error: 'invalid-code' }, 400));
    await user.type(await screen.findByLabelText('Code à 6 chiffres'), '000000');
    await user.click(screen.getByRole('button', { name: 'Terminer l’activation' }));
    expect(await screen.findByText(/Code incorrect/)).toBeInTheDocument();
    expect(screen.getByLabelText('Code à 6 chiffres')).toBeInTheDocument();
  });

  it('a right code ends on the done screen with a link to sign in', async () => {
    const user = userEvent.setup();
    await reachAuthenticatorStep(user);
    fetchMock.mockResolvedValueOnce(reply({ ok: true }));
    await user.type(await screen.findByLabelText('Code à 6 chiffres'), '123456');
    await user.click(screen.getByRole('button', { name: 'Terminer l’activation' }));
    expect(await screen.findByText('Compte activé')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Se connecter' })).toHaveAttribute('href', '/erp/connexion');
    expect(sentActions()).toEqual(['check', 'setpassword', 'verify']);
    const verifyBody = JSON.parse((fetchMock.mock.calls[2][1] as RequestInit).body as string) as Record<string, string>;
    expect(verifyBody).toMatchObject({ token: 'inv-1.sig', code: '123456', accessToken: 'access-1' });
  });
});
