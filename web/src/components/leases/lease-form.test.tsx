import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LeaseForm } from './lease-form';

vi.mock('@/lib/use-graphql', () => ({
  useGraphql: () => ({ status: 'success', data: { units: [] } }),
}));
vi.mock('@/components/ownership/use-contact-options', () => ({
  useContactOptions: () => ({ status: 'success', data: [] }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

describe('LeaseForm help icons', () => {
  it('puts one « Aide » button on each of the 4 fields, on the units and on the 2 parties blocks', () => {
    render(<LeaseForm />);
    expect(screen.getAllByRole('button', { name: 'Aide' })).toHaveLength(7);
  });

  it('keeps the field labels resolving to a single element each', () => {
    render(<LeaseForm />);
    for (const label of ['Début du bail', 'Fin du bail', 'Jour de paiement', 'Dépôt de garantie (TND)']) {
      expect(screen.getByLabelText(label)).toBeInstanceOf(HTMLInputElement);
    }
  });

  it('explains the start date when its help is opened', async () => {
    render(<LeaseForm />);
    const [startHelp] = screen.getAllByRole('button', { name: 'Aide' });
    await userEvent.click(startHelp);
    expect(await screen.findByText(/Premier jour du bail, inclus/)).toBeInTheDocument();
  });
});
