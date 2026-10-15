import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SharesTable } from './shares-table';

const UNITS = [
  { id: 'a', code: 'A-1', surface_m2: 50, common_share: 500 },
  { id: 'b', code: 'B-1', surface_m2: '50.00', common_share: 400 },
];

describe('SharesTable', () => {
  it('shows a red total when the building does not reach 1000', () => {
    render(<SharesTable units={UNITS} canEdit onSaved={() => {}} />);
    expect(screen.getByText('Total : 900 / 1000')).toHaveClass('text-destructive');
  });

  it('suggests thousandths from surfaces', async () => {
    render(<SharesTable units={UNITS} canEdit onSaved={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Proposer selon les surfaces' }));
    expect(screen.getByLabelText('Tantièmes de A-1')).toHaveValue('500');
    expect(screen.getByLabelText('Tantièmes de B-1')).toHaveValue('500');
    expect(screen.getByText('Total : 1000 / 1000')).toHaveClass('text-success');
  });

  it('flags a value above 1000 as invalid', async () => {
    render(<SharesTable units={UNITS} canEdit onSaved={() => {}} />);
    const input = screen.getByLabelText('Tantièmes de A-1');
    await userEvent.clear(input);
    await userEvent.type(input, '1200');
    expect(screen.getByText('Valeurs entières de 0 à 1000 uniquement.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer les tantièmes' })).toBeDisabled();
  });
});
