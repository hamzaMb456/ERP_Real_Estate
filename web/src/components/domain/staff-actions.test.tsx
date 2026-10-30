import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/provider';

const staffAction = vi.fn();
vi.mock('@/lib/staff-api', () => ({ staffAction: (...args: unknown[]) => staffAction(...args) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { StaffActions } from './staff-actions';

const member = (status: 'invited' | 'confirmed' | 'disabled') => ({ user_id: 'staff-9', display_name: 'Amel', email: 'a@b.tn', branch_ids: ['b-1'], status });

function setup(status: 'invited' | 'confirmed' | 'disabled') {
  const onDone = vi.fn();
  render(
    <I18nProvider>
      <StaffActions member={member(status)} onDone={onDone} />
    </I18nProvider>,
  );
  return { onDone, user: userEvent.setup() };
}

const names = () => screen.queryAllByRole('button').map((button) => button.textContent?.trim());

beforeEach(() => staffAction.mockReset());

describe('StaffActions', () => {
  it('offers the actions that fit the status', () => {
    setup('invited');
    expect(names()).toEqual(['Renvoyer l’invitation', 'Désactiver']);
  });

  it('a confirmed account can have its authenticator reset or be disabled', () => {
    setup('confirmed');
    expect(names()).toEqual(['Réinitialiser l’authentificateur', 'Désactiver']);
  });

  it('a disabled account has no action', () => {
    setup('disabled');
    expect(names()).toEqual([]);
  });

  it('resend posts action resend for the member', async () => {
    staffAction.mockResolvedValue({ ok: true });
    const { user, onDone } = setup('invited');
    await user.click(screen.getByRole('button', { name: 'Renvoyer l’invitation' }));
    await waitFor(() => expect(staffAction).toHaveBeenCalledWith('resend', { userId: 'staff-9' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('disable asks for confirmation before posting', async () => {
    staffAction.mockResolvedValue({ ok: true });
    const { user, onDone } = setup('confirmed');
    await user.click(screen.getByRole('button', { name: 'Désactiver' }));
    expect(staffAction).not.toHaveBeenCalled();
    expect(await screen.findByText('Désactiver ce compte ?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Désactiver le compte' }));
    await waitFor(() => expect(staffAction).toHaveBeenCalledWith('disable', { userId: 'staff-9' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });
});
