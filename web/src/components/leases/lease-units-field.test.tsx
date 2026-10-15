import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LeaseUnitsField, type UnitOption } from './lease-units-field';

const OPTIONS: UnitOption[] = [
  { id: 'u1', code: 'B-101', rent_amount: 980, property: { id: 'p1', name: 'Résidence Carthage' } },
  { id: 'u2', code: 'B-102', rent_amount: null, property: { id: 'p1', name: 'Résidence Carthage' } },
];

describe('LeaseUnitsField', () => {
  it('prefills the rent of a unit when it is chosen', async () => {
    const onChange = vi.fn();
    render(<LeaseUnitsField options={OPTIONS} value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'B-101 · Résidence Carthage' }));
    expect(onChange).toHaveBeenCalledWith([{ unitId: 'u1', rent: '980', charges: '' }]);
  });

  it('starts with an empty rent when the unit has none', async () => {
    const onChange = vi.fn();
    render(<LeaseUnitsField options={OPTIONS} value={[]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'B-102 · Résidence Carthage' }));
    expect(onChange).toHaveBeenCalledWith([{ unitId: 'u2', rent: '', charges: '' }]);
  });

  it('removes a unit when it is unchecked', async () => {
    const onChange = vi.fn();
    render(<LeaseUnitsField options={OPTIONS} value={[{ unitId: 'u1', rent: '980', charges: '' }]} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'B-101 · Résidence Carthage' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('shows rent and charges inputs only for chosen units and reports edits', () => {
    const onChange = vi.fn();
    render(<LeaseUnitsField options={OPTIONS} value={[{ unitId: 'u1', rent: '980', charges: '' }]} onChange={onChange} />);
    expect(screen.queryByLabelText('Loyer B-102')).toBeNull();
    expect(screen.getByLabelText('Loyer B-101')).toHaveValue('980');
    fireEvent.change(screen.getByLabelText('Charges B-101'), { target: { value: '40' } });
    expect(onChange).toHaveBeenCalledWith([{ unitId: 'u1', rent: '980', charges: '40' }]);
  });

  it('says so when no unit is free', () => {
    render(<LeaseUnitsField options={[]} value={[]} onChange={() => {}} />);
    expect(screen.getByText('Aucune unité disponible.')).toBeInTheDocument();
  });
});
