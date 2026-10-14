import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ContactOption } from './contact-picker';
import { OwnersEditor } from './owners-editor';

const OPTIONS: ContactOption[] = [
  { id: 'c1', full_name: 'Hédi Ben Salem', kind: 'person', is_organization: false },
  { id: 'c2', full_name: 'Salma Gharbi', kind: 'person', is_organization: false },
];

describe('OwnersEditor', () => {
  it('shows a red total when shares do not reach 100 %', () => {
    render(
      <OwnersEditor
        value={[{ contactId: 'c1', sharePercent: 60 }, { contactId: 'c2', sharePercent: 30 }]}
        onChange={() => {}}
        options={OPTIONS}
      />,
    );
    const total = screen.getByText('Total : 90 %');
    expect(total).toHaveClass('text-destructive');
  });

  it('adds a co-owner row pre-filled with the remaining share', async () => {
    const onChange = vi.fn();
    render(<OwnersEditor value={[{ contactId: 'c1', sharePercent: 60 }]} onChange={onChange} options={OPTIONS} />);
    await userEvent.click(screen.getByRole('button', { name: /Ajouter un copropriétaire/ }));
    expect(onChange).toHaveBeenCalledWith([
      { contactId: 'c1', sharePercent: 60 },
      { contactId: null, sharePercent: 40 },
    ]);
  });

  it('never removes the last row', () => {
    render(<OwnersEditor value={[{ contactId: 'c1', sharePercent: 100 }]} onChange={() => {}} options={OPTIONS} />);
    expect(screen.getByRole('button', { name: 'Retirer la ligne 1' })).toBeDisabled();
    expect(screen.getByText('Total : 100 %')).toHaveClass('text-success');
  });
});
