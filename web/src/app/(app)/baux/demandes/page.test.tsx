import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RentRequestsPage from './page';

describe('/baux/demandes', () => {
  it('shows the « Demandes de location » placeholder instead of being read as a lease id', () => {
    render(<RentRequestsPage />);
    expect(screen.getAllByText('Demandes de location').length).toBeGreaterThan(0);
  });
});
