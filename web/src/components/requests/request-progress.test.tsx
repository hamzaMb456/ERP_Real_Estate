import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { I18nProvider } from '@/i18n/provider';
import { RequestProgress } from './request-progress';

const show = (outcome: 'pending' | 'accepted' | 'rejected') =>
  render(
    <I18nProvider>
      <RequestProgress outcome={outcome} />
    </I18nProvider>,
  );

describe('RequestProgress', () => {
  it('half full and labelled « En attente » while the request is pending', () => {
    show('pending');
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'En attente' })).toHaveAttribute('aria-valuenow', '50');
  });

  it('full and labelled « Acceptée » once accepted', () => {
    show('accepted');
    expect(screen.getByText('Acceptée')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Acceptée' })).toHaveAttribute('aria-valuenow', '100');
  });

  it('full and labelled « Refusée » once refused', () => {
    show('rejected');
    expect(screen.getByText('Refusée')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Refusée' })).toHaveAttribute('aria-valuenow', '100');
  });
});
