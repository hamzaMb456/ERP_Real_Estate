import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/provider';

const staffAction = vi.fn();
vi.mock('@/lib/staff-api', () => ({ staffAction: (...args: unknown[]) => staffAction(...args) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from 'sonner';
import { StaffCreateDialog } from './staff-create-dialog';

const branches = [{ id: 'b-1', name: 'Aouina' }, { id: 'b-2', name: 'Bizerte' }];

function setup() {
  const onSaved = vi.fn();
  render(
    <I18nProvider>
      <StaffCreateDialog branches={branches} trigger={<button type="button">Ouvrir</button>} onSaved={onSaved} />
    </I18nProvider>,
  );
  return { onSaved, user: userEvent.setup() };
}

async function openAndFill(user: ReturnType<typeof userEvent.setup>, email = 'amel@agence.tn') {
  await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
  await user.type(await screen.findByLabelText('Nom complet'), 'Amel Trabelsi');
  await user.click(screen.getByRole('button', { name: 'Continuer' }));
  await user.type(await screen.findByLabelText('Adresse e-mail'), email);
  await user.click(screen.getByRole('button', { name: 'Continuer' }));
}

beforeEach(() => {
  staffAction.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe('StaffCreateDialog', () => {
  it('keeps the email step until it looks like an email', async () => {
    const { user } = setup();
    await openAndFill(user, 'not-an-email');
    expect(await screen.findByText(/adresse e-mail valide/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Aouina' })).not.toBeInTheDocument();
  });

  it('needs at least one agency before the account can be created', async () => {
    const { user } = setup();
    await openAndFill(user);
    await user.click(await screen.findByRole('button', { name: 'Créer et envoyer l’invitation' }));
    expect(await screen.findByText(/au moins une agence/i)).toBeInTheDocument();
    expect(staffAction).not.toHaveBeenCalled();
  });

  it('posts action create with name, email and the chosen agencies', async () => {
    staffAction.mockResolvedValue({ ok: true });
    const { user, onSaved } = setup();
    await openAndFill(user);
    await user.click(await screen.findByRole('checkbox', { name: 'Aouina' }));
    await user.click(screen.getByRole('button', { name: 'Créer et envoyer l’invitation' }));
    await waitFor(() => expect(staffAction).toHaveBeenCalledWith('create', { name: 'Amel Trabelsi', email: 'amel@agence.tn', branchIds: ['b-1'] }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalled();
  });

  it('shows the translated message when the email already has a login', async () => {
    staffAction.mockRejectedValue(new Error('email_taken'));
    const { user, onSaved } = setup();
    await openAndFill(user);
    await user.click(await screen.findByRole('checkbox', { name: 'Aouina' }));
    await user.click(screen.getByRole('button', { name: 'Créer et envoyer l’invitation' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Cette adresse a déjà un compte.'));
    expect(onSaved).not.toHaveBeenCalled();
  });
});
