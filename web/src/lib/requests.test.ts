import { describe, expect, it } from 'vitest';
import { matchesRequest, newestFirst, rentalProgress, requestUnitHeading, shortTime, telLink, visitWindow, type RentalRequest } from '@/lib/requests';

const request: RentalRequest = {
  id: 'r1',
  full_name: 'Amine Ben Salah',
  phone: '+216 20 111 222',
  email: 'amine@example.tn',
  message: null,
  staff_note: null,
  created_at: '2026-10-23T10:00:00Z',
  start_date: '2026-11-01',
  duration_months: 12,
  status: 'new',
  unit: { id: 'u1', code: 'B-102', title: null, property: { id: 'p1', name: 'Les Jardins de Carthage', city: 'Carthage' } },
};

describe('visit slots', () => {
  it('drops the seconds of a Postgres time', () => {
    expect(shortTime('10:30:00')).toBe('10:30');
  });

  it('turns a slot into a half-hour window in Tunisia time', () => {
    expect(visitWindow('2026-11-02', '10:30:00')).toEqual({ startsAt: '2026-11-02T10:30:00+01:00', endsAt: '2026-11-02T10:00:00.000Z' });
  });
});

describe('request helpers', () => {
  it('headlines a unit with its reference and its bien', () => {
    expect(requestUnitHeading(request.unit)).toBe('B-102 · Les Jardins de Carthage');
  });

  it('searches the name, e-mail, unit, bien, city and the phone digits', () => {
    for (const needle of ['amine', 'example.tn', 'b-102', 'jardins', 'carthage', '20111222', '20 111', '  ']) {
      expect(matchesRequest(request, needle), needle).toBe(true);
    }
    expect(matchesRequest(request, 'zzz')).toBe(false);
    expect(matchesRequest(request, '99')).toBe(false);
  });

  it('builds a tel link from a typed number', () => {
    expect(telLink('+216 20 111 222')).toBe('tel:+21620111222');
    expect(telLink('(71) 000-111')).toBe('tel:71000111');
  });

  it('lists the newest request first without touching the input', () => {
    const older = { ...request, id: 'r0', created_at: '2026-10-01T10:00:00Z' };
    const input = [older, request];
    expect(newestFirst(input).map((item) => item.id)).toEqual(['r1', 'r0']);
    expect(input[0].id).toBe('r0');
  });
});

describe('rentalProgress', () => {
  it('shows only pending, accepted or rejected', () => {
    expect(rentalProgress('new')).toBe('pending');
    expect(rentalProgress('contacted')).toBe('pending');
    expect(rentalProgress('accepted')).toBe('accepted');
    expect(rentalProgress('declined')).toBe('rejected');
  });

  it('a closed request shows how it ended, and a refusal when that is unknown', () => {
    expect(rentalProgress('closed', 'accepted')).toBe('accepted');
    expect(rentalProgress('closed', 'rejected')).toBe('rejected');
    expect(rentalProgress('closed', null)).toBe('rejected');
    expect(rentalProgress('closed')).toBe('rejected');
  });
});
