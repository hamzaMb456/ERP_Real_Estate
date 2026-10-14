import { describe, expect, it } from 'vitest';
import {
  dayBefore,
  formatDateFr,
  formatPercent,
  isCurrent,
  ownershipPhase,
  planTransfer,
  rowsToReopen,
  todayIso,
  validateNewOwners,
  type OwnershipRow,
} from './ownership';

const row = (over: Partial<OwnershipRow>): OwnershipRow => ({
  id: 'o1',
  unit_id: 'u1',
  contact_id: 'c1',
  share_percent: 100,
  starts_on: '2026-01-01',
  ends_on: null,
  ...over,
});

describe('dates', () => {
  it('formats today in local time as YYYY-MM-DD', () => {
    expect(todayIso(new Date(2026, 2, 5))).toBe('2026-03-05');
  });
  it('gives the day before, across months and years', () => {
    expect(dayBefore('2026-03-15')).toBe('2026-03-14');
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayBefore('2026-01-01')).toBe('2025-12-31');
  });
  it('formats dates the French way', () => {
    expect(formatDateFr('2026-03-15')).toBe('15/03/2026');
  });
  it('formats percents with a comma', () => {
    expect(formatPercent(33.333)).toBe('33,33 %');
    expect(formatPercent('100.00')).toBe('100 %');
  });
});

describe('isCurrent / ownershipPhase', () => {
  it('treats both ends as inclusive', () => {
    expect(isCurrent(row({ starts_on: '2026-03-15' }), '2026-03-15')).toBe(true);
    expect(isCurrent(row({ ends_on: '2026-03-14' }), '2026-03-14')).toBe(true);
    expect(isCurrent(row({ ends_on: '2026-03-14' }), '2026-03-15')).toBe(false);
  });
  it('classifies past, current and upcoming rows', () => {
    expect(ownershipPhase(row({ ends_on: '2026-01-31' }), '2026-02-01')).toBe('past');
    expect(ownershipPhase(row({}), '2026-02-01')).toBe('current');
    expect(ownershipPhase(row({ starts_on: '2026-05-01' }), '2026-02-01')).toBe('upcoming');
  });
});

describe('validateNewOwners', () => {
  it('accepts co-owners totalling 100 %', () => {
    expect(validateNewOwners([{ contactId: 'a', sharePercent: 50 }, { contactId: 'b', sharePercent: 50 }])).toBeNull();
  });
  it('rejects empty, missing contact, duplicates, bad shares and wrong totals', () => {
    expect(validateNewOwners([])).toBe('Ajoutez au moins un propriétaire.');
    expect(validateNewOwners([{ contactId: null, sharePercent: 100 }])).toBe('Choisissez un contact pour chaque ligne.');
    expect(validateNewOwners([{ contactId: 'a', sharePercent: 50 }, { contactId: 'a', sharePercent: 50 }])).toBe(
      'Un même contact apparaît deux fois.',
    );
    expect(validateNewOwners([{ contactId: 'a', sharePercent: 0 }])).toBe('Chaque part doit être comprise entre 0 et 100 %.');
    expect(validateNewOwners([{ contactId: 'a', sharePercent: 60 }])).toBe(
      'Le total des parts doit être 100 % (actuellement 60 %).',
    );
  });
});

describe('planTransfer', () => {
  it('ends current owners the day before and starts the new ones on the date', () => {
    const plan = planTransfer(['u1'], [row({ id: 'old' })], '2026-03-15', [{ contactId: 'c2', sharePercent: 100 }]);
    expect(plan).toEqual({
      endIds: ['old'],
      endOn: '2026-03-14',
      objects: [{ unit_id: 'u1', contact_id: 'c2', share_percent: 100, starts_on: '2026-03-15' }],
    });
  });
  it('ignores rows of other units and rows already ended before the date', () => {
    const rows = [row({ id: 'other', unit_id: 'u9' }), row({ id: 'ended', ends_on: '2026-02-01' })];
    const plan = planTransfer(['u1'], rows, '2026-03-15', [{ contactId: 'c2', sharePercent: 100 }]);
    expect(plan).toMatchObject({ endIds: [] });
  });
  it('creates rows for every selected unit (bulk "same owner for all units")', () => {
    const plan = planTransfer(['u1', 'u2'], [], '2026-01-01', [{ contactId: 'c1', sharePercent: 100 }]);
    expect('objects' in plan ? plan.objects : []).toHaveLength(2);
  });
  it('refuses a date on or before the start of a current holding', () => {
    const plan = planTransfer(['u1'], [row({ starts_on: '2026-03-15' })], '2026-03-15', [{ contactId: 'c2', sharePercent: 100 }]);
    expect(plan).toEqual({
      error: 'La date doit être postérieure au 15/03/2026, début de la détention actuelle.',
    });
  });
  it('returns the validation error when owners are invalid', () => {
    expect(planTransfer(['u1'], [], '2026-03-15', [])).toEqual({ error: 'Ajoutez au moins un propriétaire.' });
  });
});

describe('rowsToReopen', () => {
  it('finds the holdings a cancelled upcoming transfer had closed', () => {
    const rows = [
      row({ id: 'old', ends_on: '2026-03-14' }),
      row({ id: 'other-unit', unit_id: 'u9', ends_on: '2026-03-14' }),
      row({ id: 'earlier', ends_on: '2026-01-31' }),
    ];
    const cancelled = row({ id: 'new', contact_id: 'c2', starts_on: '2026-03-15' });
    expect(rowsToReopen(rows, cancelled)).toEqual(['old']);
  });
});
