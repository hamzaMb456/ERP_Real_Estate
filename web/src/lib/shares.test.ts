import { describe, expect, it } from 'vitest';
import { sharesTotal, suggestShares } from './shares';

describe('suggestShares', () => {
  it('splits 1000 by surface with largest remainders (Résidence example)', () => {
    const result = suggestShares([
      { id: 'b101', surface: 92 },
      { id: 'b102', surface: '110.00' },
      { id: 'b203', surface: 118 },
      { id: 'a204', surface: 96.5 },
    ]);
    expect(result).toEqual({ b101: 221, b102: 264, b203: 283, a204: 232 });
    expect(sharesTotal(Object.values(result))).toBe(1000);
  });
  it('splits equally when no unit has a surface', () => {
    const result = suggestShares([{ id: 'a', surface: null }, { id: 'b', surface: null }, { id: 'c', surface: null }]);
    expect(sharesTotal(Object.values(result))).toBe(1000);
    expect(Object.values(result).sort()).toEqual([333, 333, 334]);
  });
  it('gives 0 to units without surface when others have one', () => {
    expect(suggestShares([{ id: 'a', surface: 50 }, { id: 'b', surface: null }])).toEqual({ a: 1000, b: 0 });
  });
  it('returns an empty object for no units', () => {
    expect(suggestShares([])).toEqual({});
  });
});

describe('sharesTotal', () => {
  it('ignores empty values', () => {
    expect(sharesTotal([500, null, undefined, 250])).toBe(750);
  });
});
