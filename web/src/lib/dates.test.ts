import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, todayTunis } from './dates';

describe('todayTunis', () => {
  it('is already tomorrow in Tunis at 23:30 UTC', () => {
    expect(todayTunis(new Date('2026-10-14T23:30:00Z'))).toBe('2026-10-15');
  });

  it('is still today in Tunis at 22:30 UTC', () => {
    expect(todayTunis(new Date('2026-10-14T22:30:00Z'))).toBe('2026-10-14');
  });
});

describe('addDays', () => {
  it('crosses a month end', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('goes back across a month start', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('daysBetween', () => {
  it('counts whole days forward', () => {
    expect(daysBetween('2026-10-15', '2026-12-14')).toBe(60);
  });

  it('is negative when the second date is earlier', () => {
    expect(daysBetween('2026-10-15', '2026-10-12')).toBe(-3);
  });

  it('is zero for the same day', () => {
    expect(daysBetween('2026-10-15', '2026-10-15')).toBe(0);
  });
});
