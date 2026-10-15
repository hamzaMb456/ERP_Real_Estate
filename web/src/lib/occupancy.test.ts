import { describe, expect, it } from 'vitest';
import { occupancyLevel } from './occupancy';

describe('occupancyLevel', () => {
  it('classifies a bien by its units', () => {
    expect(occupancyLevel([])).toBe('none');
    expect(occupancyLevel(['vacant', 'for_sale'])).toBe('empty');
    expect(occupancyLevel(['rented', 'vacant'])).toBe('partial');
    expect(occupancyLevel(['rented', 'rented'])).toBe('full');
  });
});
