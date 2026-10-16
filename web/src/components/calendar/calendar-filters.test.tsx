import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { ContactOption } from '@/components/ownership/contact-picker';
import { CalendarFilters } from './calendar-filters';
import { EMPTY_FILTERS, type BranchOption, type StaffOption } from './calendar-types';

const STAFF: StaffOption[] = [
  { user_id: 'u1', display_name: 'Karim Trabelsi', email: 'karim@example.tn', role: 'manager' },
  { user_id: 'u2', display_name: 'Leila Mansour', email: 'leila@example.tn', role: 'org_admin' },
];
const CONTACTS: ContactOption[] = [{ id: 'c1', full_name: 'Salma Gharbi', kind: 'person', is_organization: false }];
const BRANCHES: BranchOption[] = [{ id: 'b1', name: 'Tunis centre' }];

// Radix Select needs a few browser APIs that jsdom does not implement.
beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

const props = { staff: STAFF, contacts: CONTACTS, branches: BRANCHES };

describe('CalendarFilters', () => {
  it('sets the staff filter when a collaborator is chosen', async () => {
    const onChange = vi.fn();
    render(<CalendarFilters {...props} value={EMPTY_FILTERS} onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Collaborateur' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Leila Mansour' }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, staffId: 'u2' });
  });

  it('clears the staff filter with « Tous les collaborateurs »', async () => {
    const onChange = vi.fn();
    render(<CalendarFilters {...props} value={{ ...EMPTY_FILTERS, staffId: 'u1' }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Collaborateur' }));
    await userEvent.click(await screen.findByRole('option', { name: 'Tous les collaborateurs' }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, staffId: null });
  });

  it('flips the cancelled toggle', async () => {
    const onChange = vi.fn();
    render(<CalendarFilters {...props} value={EMPTY_FILTERS} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Afficher les rendez-vous annulés' }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, includeCancelled: true });
  });

  it('adds a kind to the filter', async () => {
    const onChange = vi.fn();
    render(<CalendarFilters {...props} value={EMPTY_FILTERS} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Visite' }));
    expect(onChange).toHaveBeenCalledWith({ ...EMPTY_FILTERS, kinds: ['viewing'] });
  });
});
