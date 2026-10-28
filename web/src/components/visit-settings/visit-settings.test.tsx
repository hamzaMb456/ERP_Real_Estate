import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { VisitSettings } from './visit-settings';

const graphql = vi.hoisted(() => vi.fn());
vi.mock('@/lib/graphql', () => ({ graphql }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Select needs a few browser APIs that jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

describe('VisitSettings', () => {
  beforeEach(() => {
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    graphql.mockReset();
    graphql.mockImplementation(async (query: string) =>
      query.includes('mutation')
        ? { update_organizations_by_pk: { id: 'org-1' } }
        : { organizations: [{ id: 'org-1', visit_payment_method: 'virtual', visit_payment_instructions: 'Virement RIB TN59 ...' }] },
    );
  });

  it('shows the organization current choice and keeps save disabled until it changes', async () => {
    render(<VisitSettings />);
    expect(await screen.findByText('À distance (virement, D17, Flouci…)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Virement RIB TN59 ...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('saves the picked method and reports success', async () => {
    render(<VisitSettings />);
    await screen.findByText('À distance (virement, D17, Flouci…)');
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'Gratuit' }));

    const saveButton = screen.getByRole('button', { name: 'Enregistrer' });
    expect(saveButton).not.toBeDisabled();
    await userEvent.click(saveButton);

    await waitFor(() => {
      const call = graphql.mock.calls.find(([query]) => String(query).includes('mutation'));
      expect(call).toBeDefined();
      expect(call![1]).toEqual({ id: 'org-1', value: null, instructions: null });
    });
    expect(toast.success).toHaveBeenCalledWith('Préférence enregistrée.');
  });

  it('requires instructions before saving the remote method, and sends them trimmed', async () => {
    graphql.mockImplementation(async (query: string) =>
      query.includes('mutation')
        ? { update_organizations_by_pk: { id: 'org-1' } }
        : { organizations: [{ id: 'org-1', visit_payment_method: 'manual', visit_payment_instructions: null }] },
    );
    render(<VisitSettings />);
    await screen.findByText('Sur place (espèces à l’agent)');
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: 'À distance (virement, D17, Flouci…)' }));

    const saveButton = screen.getByRole('button', { name: 'Enregistrer' });
    expect(saveButton).toBeDisabled();
    expect(screen.getByText('Expliquez comment payer à distance avant d’enregistrer ce mode.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Comment payer à distance'), '  D17 au 71 000 000.  ');
    expect(saveButton).not.toBeDisabled();
    await userEvent.click(saveButton);

    await waitFor(() => {
      const call = graphql.mock.calls.find(([query]) => String(query).includes('mutation'));
      expect(call![1]).toEqual({ id: 'org-1', value: 'virtual', instructions: 'D17 au 71 000 000.' });
    });
  });
});
