import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LeaseDetails } from './lease-details';

let canEdit = true;
vi.mock('@/lib/use-can-edit', () => ({ useCanEdit: () => canEdit }));
vi.mock('@/lib/graphql', () => ({ graphql: vi.fn() }));

import { LeaseActions } from './lease-actions';

const lease = (patch: Partial<LeaseDetails> = {}): LeaseDetails =>
  ({
    id: 'L1',
    number: 12,
    status: 'draft',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    archived_at: null,
    units: [],
    current_rents: [],
    ...patch,
  }) as LeaseDetails;

const names = () => screen.queryAllByRole('button').map((button) => button.textContent?.trim());

beforeEach(() => {
  canEdit = true;
});

describe('LeaseActions', () => {
  it('shows nothing to a viewer', () => {
    canEdit = false;
    const { container } = render(<LeaseActions lease={lease({ status: 'active' })} onChanged={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offers modify, activate and archive on a draft', () => {
    render(<LeaseActions lease={lease()} onChanged={() => {}} />);
    expect(screen.getByRole('link', { name: 'Modifier' })).toHaveAttribute('href', '/erp/baux/L1/modifier');
    expect(names()).toEqual(['Activer', 'Archiver']);
  });

  it('offers renew and end on an active lease, and nothing else', () => {
    render(<LeaseActions lease={lease({ status: 'active' })} onChanged={() => {}} />);
    expect(names()).toEqual(['Renouveler', 'Terminer']);
    expect(screen.queryByRole('link', { name: 'Modifier' })).toBeNull();
  });

  it('offers only restore on an archived draft', () => {
    render(<LeaseActions lease={lease({ archived_at: '2026-10-01T00:00:00Z' })} onChanged={() => {}} />);
    expect(names()).toEqual(['Restaurer']);
  });

  it('offers no action on an ended or expired lease', () => {
    const { container } = render(<LeaseActions lease={lease({ status: 'ended' })} onChanged={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
