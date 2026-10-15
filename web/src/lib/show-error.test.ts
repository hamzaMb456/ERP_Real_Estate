import { beforeEach, describe, expect, it, vi } from 'vitest';

const error = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => error(...args) } }));

import { showError } from './show-error';

beforeEach(() => error.mockClear());

describe('showError', () => {
  it('shows the French sentence under the title', () => {
    showError('Action impossible', new Error('lease_not_draft'));
    expect(error).toHaveBeenCalledWith('Action impossible', {
      description: 'Ce bail ne peut plus être modifié.',
      action: undefined,
    });
  });

  it('adds a « Réessayer » action for a network failure when a retry is given', () => {
    const retry = vi.fn();
    showError('Action impossible', new TypeError('Failed to fetch'), retry);
    const options = error.mock.calls[0][1] as { action: { label: string; onClick: () => void } };
    expect(options.action.label).toBe('Réessayer');
    options.action.onClick();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('adds no action for a business-rule failure even with a retry', () => {
    showError('Action impossible', new Error('lease_overlap:3'), vi.fn());
    expect((error.mock.calls[0][1] as { action: unknown }).action).toBeUndefined();
  });
});
