import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/provider';

vi.mock('@/lib/graphql', () => ({ graphql: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { UnitDialog, type UnitFormUnit } from './unit-dialog';

const TYPE_LABELS = ['Appartement', 'Bureau', 'Commerce', 'Parking', 'Maison', 'Terrain'];

async function typeStep(unit?: UnitFormUnit) {
  const user = userEvent.setup();
  render(
    <I18nProvider>
      <UnitDialog propertyId="p-1" unit={unit} trigger={<button type="button">Ouvrir</button>} onSaved={vi.fn()} />
    </I18nProvider>,
  );
  await user.click(screen.getByRole('button', { name: 'Ouvrir' }));
  if (!unit) await user.type(await screen.findByLabelText('Référence *'), 'A-101');
  await user.click(await screen.findByRole('button', { name: 'Continuer' }));
  return screen.findByText('Statut *');
}

const shown = () => TYPE_LABELS.filter((label) => screen.queryByText(label) !== null);

describe('UnitDialog unit types', () => {
  it('offers only the kinds of unit a building holds when adding one', async () => {
    await typeStep();
    expect(shown()).toEqual(['Appartement', 'Bureau', 'Commerce', 'Parking']);
  });

  it('keeps Maison for a house unit that is being edited, since its type must stay valid', async () => {
    await typeStep({
      id: 'u-1', code: 'MAISON', type: 'house', status: 'vacant', floor: null, rooms: null, surface_m2: null, rent_amount: null,
      title: null, description: null, sale_price: null, charges: null, available_from: null, furnished: false, amenities: [],
      show_on_website: true, bedrooms: null, bathrooms: null, parking_spaces: null, property_condition: null, orientation: [],
      balcony_m2: null, terrace_m2: null, garden_m2: null, energy_class: null, deposit_months: 2, min_lease_months: null,
      pets_allowed: null, charges_included: [], legal_status: null, reservation_deposit: 10000, reservation_days: 15,
      virtual_tour_url: null, visit_fee: null,
    });
    expect(shown()).toContain('Maison');
    expect(shown()).not.toContain('Terrain');
  });
});
