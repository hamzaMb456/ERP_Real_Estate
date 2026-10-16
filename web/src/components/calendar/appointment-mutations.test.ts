import { describe, expect, it } from 'vitest';
import { changedFields, diffParticipants, type AppointmentFields } from './appointment-mutations';

const before: AppointmentFields = {
  kind: 'viewing',
  title: 'Visite B-101',
  location: null,
  starts_at: '2026-10-16T09:00:00+01:00',
  ends_at: '2026-10-16T10:00:00+01:00',
  assigned_user_id: null,
  unit_id: 'u1',
  lease_id: null,
  notify_by_email: true,
  notes: null,
};

describe('diffParticipants', () => {
  it('leaves an unchanged set alone, so no invitation is re-sent', () => {
    const set = [
      { contactId: 'c1', role: 'renter' as const },
      { contactId: 'c2', role: 'guarantor' as const },
    ];
    expect(diffParticipants(set, [...set].reverse())).toEqual({ added: [], removed: [] });
  });

  it('adds new contacts and removes the ones that left', () => {
    const result = diffParticipants(
      [
        { contactId: 'c1', role: 'renter' },
        { contactId: 'c2', role: 'renter' },
      ],
      [
        { contactId: 'c2', role: 'renter' },
        { contactId: 'c3', role: 'prospect' },
      ],
    );
    expect(result.added).toEqual([{ contactId: 'c3', role: 'prospect' }]);
    expect(result.removed).toEqual(['c1']);
  });

  it('replaces a participant whose role changed (the role cannot be updated)', () => {
    const result = diffParticipants([{ contactId: 'c1', role: 'prospect' }], [{ contactId: 'c1', role: 'renter' }]);
    expect(result.removed).toEqual(['c1']);
    expect(result.added).toEqual([{ contactId: 'c1', role: 'renter' }]);
  });
});

describe('changedFields', () => {
  it('returns nothing when nothing changed', () => {
    expect(changedFields(before, { ...before })).toEqual({});
  });

  it('treats the same instant written with another offset as unchanged', () => {
    expect(changedFields(before, { ...before, starts_at: '2026-10-16T08:00:00+00:00' })).toEqual({});
  });

  it('returns only the fields that changed', () => {
    expect(changedFields(before, { ...before, title: 'Autre', ends_at: '2026-10-16T11:00:00+01:00' })).toEqual({
      title: 'Autre',
      ends_at: '2026-10-16T11:00:00+01:00',
    });
  });
});
