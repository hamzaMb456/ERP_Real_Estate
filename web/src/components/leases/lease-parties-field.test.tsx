import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ContactOption } from '@/components/ownership/contact-picker';
import { LeasePartiesField } from './lease-parties-field';

const OPTIONS: ContactOption[] = [
  { id: 'c1', full_name: 'Salma Gharbi', kind: 'person', is_organization: false },
  { id: 'c2', full_name: 'Hédi Ben Salem', kind: 'person', is_organization: false },
];

const props = { legend: 'Locataires', addLabel: 'Ajouter un locataire', rowLabel: 'locataire', options: OPTIONS, taken: [] as string[] };

describe('LeasePartiesField', () => {
  it('adds an empty row', async () => {
    const onChange = vi.fn();
    render(<LeasePartiesField {...props} value={['c1']} onChange={onChange} minRows={1} />);
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un locataire' }));
    expect(onChange).toHaveBeenCalledWith(['c1', null]);
  });

  it('never removes the last required row', () => {
    render(<LeasePartiesField {...props} value={['c1']} onChange={() => {}} minRows={1} />);
    expect(screen.getByRole('button', { name: 'Retirer locataire 1' })).toBeDisabled();
  });

  it('removes a row when more than the minimum are present', async () => {
    const onChange = vi.fn();
    render(<LeasePartiesField {...props} value={['c1', 'c2']} onChange={onChange} minRows={1} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retirer locataire 2' }));
    expect(onChange).toHaveBeenCalledWith(['c1']);
  });

  it('lets guarantors be removed down to none', async () => {
    const onChange = vi.fn();
    render(<LeasePartiesField {...props} legend="Garants" addLabel="Ajouter un garant" rowLabel="garant" value={[null]} onChange={onChange} minRows={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retirer garant 1' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
