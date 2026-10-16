import { describe, expect, it } from 'vitest';
import { dateFromParam, paramFromView, viewFromParam, visibleRange } from './calendar-url';

describe('calendar url state', () => {
  it('maps French view names to FullCalendar views and back', () => {
    expect(viewFromParam('semaine')).toBe('timeGridWeek');
    expect(viewFromParam('liste')).toBe('listWeek');
    expect(viewFromParam('mois')).toBe('dayGridMonth');
    expect(viewFromParam(null)).toBe('dayGridMonth');
    expect(viewFromParam('nimporte')).toBe('dayGridMonth');
    expect(paramFromView('timeGridWeek')).toBe('semaine');
  });

  it('keeps a valid date and falls back to today otherwise', () => {
    expect(dateFromParam('2026-10-16', '2026-01-01')).toBe('2026-10-16');
    expect(dateFromParam('2026-13-45', '2026-01-01')).toBe('2026-01-01');
    expect(dateFromParam('demain', '2026-01-01')).toBe('2026-01-01');
    expect(dateFromParam(null, '2026-01-01')).toBe('2026-01-01');
  });

  it('covers the whole Monday-first week for the week and list views', () => {
    // 2026-10-16 is a Friday.
    expect(visibleRange('timeGridWeek', '2026-10-16')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(visibleRange('listWeek', '2026-10-18')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
  });

  it('covers every day shown by the month grid', () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    expect(visibleRange('dayGridMonth', '2026-10-16')).toEqual({ from: '2026-09-28', to: '2026-11-01' });
  });
});
