import { describe, expect, it } from 'vitest';
import type { FeedRow } from '@/lib/appointment-types';
import { activateLocale } from '@/i18n/store';
import { leaseEventKindLabels, calendarRangeQuery, filterFeed, toEventInput, type CalendarFilters } from '@/lib/calendar';

const row = (over: Partial<FeedRow> = {}): FeedRow => ({
  event_id: 'a:1',
  organization_id: 'org',
  source: 'appointment',
  kind: 'viewing',
  title: 'Visite appartement',
  starts_at: '2026-10-16T09:00:00+01:00',
  ends_at: '2026-10-16T10:00:00+01:00',
  all_day: false,
  status: 'planned',
  appointment_id: '1',
  lease_id: null,
  unit_id: 'u1',
  branch_id: 'b1',
  assigned_user_id: 's1',
  contact_ids: ['c1', 'c2'],
  location: null,
  notify_by_email: true,
  ...over,
});

const leaseRow = (over: Partial<FeedRow> = {}): FeedRow =>
  row({
    event_id: 'l:9:u1:lease_end',
    source: 'lease',
    kind: 'lease_end',
    title: 'Bail 12',
    starts_at: '2026-12-30T23:00:00+00:00',
    ends_at: '2026-12-31T23:00:00+00:00',
    all_day: true,
    status: 'active',
    appointment_id: null,
    lease_id: '9',
    assigned_user_id: null,
    ...over,
  });

const none: CalendarFilters = { kinds: [], contactId: null, staffId: null, branchId: null, includeCancelled: false };

describe('filterFeed', () => {
  const rows = [
    row({ event_id: '1' }),
    row({ event_id: '2', status: 'cancelled' }),
    row({ event_id: '3', kind: 'meeting', branch_id: 'b2', assigned_user_id: 's2', contact_ids: ['c3'] }),
    leaseRow({ event_id: '4' }),
  ];
  const ids = (filters: Partial<CalendarFilters>) => filterFeed(rows, { ...none, ...filters }).map((r) => r.event_id);

  it('drops cancelled rows unless includeCancelled', () => {
    expect(ids({})).toEqual(['1', '3', '4']);
    expect(ids({ includeCancelled: true })).toEqual(['1', '2', '3', '4']);
  });

  it('keeps everything non-cancelled when filters are empty', () => {
    expect(filterFeed(rows, none)).toHaveLength(3);
  });

  it('filters by kind', () => {
    expect(ids({ kinds: ['meeting', 'lease_end'] })).toEqual(['3', '4']);
  });

  it('filters by contact, staff and branch', () => {
    expect(ids({ contactId: 'c3' })).toEqual(['3']);
    expect(ids({ staffId: 's1' })).toEqual(['1']);
    expect(ids({ branchId: 'b2' })).toEqual(['3']);
  });

  it('combines filters with AND', () => {
    expect(ids({ kinds: ['viewing'], staffId: 's2' })).toEqual([]);
  });
});

describe('toEventInput', () => {
  it('maps an appointment to a timed event with its own title', () => {
    const event = toEventInput(row());
    expect(event).toEqual({
      id: 'a:1',
      title: 'Visite appartement',
      start: '2026-10-16T09:00:00+01:00',
      end: '2026-10-16T10:00:00+01:00',
      allDay: false,
      classNames: ['ev-appointment', 'ev-viewing', 'ev-status-planned'],
      extendedProps: {
        source: 'appointment',
        kind: 'viewing',
        appointmentId: '1',
        leaseId: null,
        unitId: 'u1',
        status: 'planned',
      },
    });
  });

  it('maps a lease row to an all-day event ending on the next Tunis midnight', () => {
    const event = toEventInput(leaseRow());
    expect(event.allDay).toBe(true);
    expect(event.start).toBe('2026-12-31');
    expect(event.end).toBe('2027-01-01');
    expect(event.title).toBe('Fin du bail · Bail 12');
    expect(event.classNames).toContain('ev-lease');
    expect(event.extendedProps.leaseId).toBe('9');
  });

  it('titles every lease kind in French', () => {
    expect(leaseEventKindLabels()).toEqual({
      lease_start: 'Début du bail',
      lease_end: 'Fin du bail',
      registration_deadline: 'Échéance d’enregistrement',
    });
    expect(toEventInput(leaseRow({ kind: 'lease_start' })).title).toBe('Début du bail · Bail 12');
    expect(toEventInput(leaseRow({ kind: 'registration_deadline' })).title).toBe('Échéance d’enregistrement · Bail 12');
  });

  it('titles lease rows in the interface language', () => {
    activateLocale('ar');
    try {
      expect(toEventInput(leaseRow()).title).toBe('نهاية العقد · Bail 12');
    } finally {
      activateLocale('fr');
    }
  });

  it('falls back to the raw kind for an unknown lease kind', () => {
    expect(toEventInput(leaseRow({ kind: 'mystery' })).title).toBe('mystery · Bail 12');
  });
});

describe('calendarRangeQuery', () => {
  it('spans the whole first and last Tunis days', () => {
    expect(calendarRangeQuery('2026-10-01', '2026-10-31')).toEqual({
      from: '2026-10-01T00:00:00+01:00',
      to: '2026-10-31T23:59:59+01:00',
    });
  });
});
