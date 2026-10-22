import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DuplicateNotice } from './duplicate-notice';

describe('DuplicateNotice', () => {
  it('renders nothing without matches', () => {
    const { container } = render(<DuplicateNotice matches={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the existing contact, the matching fields and links to it', () => {
    render(
      <DuplicateNotice
        matches={[
          {
            contact: { id: 'c1', full_name: 'Salma Gharbi', national_id: null, email: null, phone: '+216 25 000 005' },
            fields: ['phone', 'email'],
          },
        ]}
      />,
    );
    expect(screen.getByText(/Même téléphone, e-mail que/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Salma Gharbi' })).toHaveAttribute('href', '/erp/contacts/c1');
  });
});
