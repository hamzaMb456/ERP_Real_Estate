import { describe, expect, it } from 'vitest';
import {
  isSunday,
  isValid,
  requestErrorCode,
  validateContact,
  validateRental,
  validateVisit,
  VISIT_SLOTS,
  visitDays,
} from './request-form';

// 2026-10-23 is a Friday.
const TODAY = '2026-10-23';
const contact = { fullName: 'Amine Ben Salah', phone: '+216 20 111 222', email: '', message: '' };

describe('visit slots and days', () => {
  it('offers a slot every half hour from 09:00 to 17:30', () => {
    expect(VISIT_SLOTS).toHaveLength(18);
    expect(VISIT_SLOTS[0]).toBe('09:00');
    expect(VISIT_SLOTS[1]).toBe('09:30');
    expect(VISIT_SLOTS.at(-1)).toBe('17:30');
  });

  it('offers tomorrow to 30 days ahead without Sundays', () => {
    const days = visitDays(TODAY);
    expect(days[0]).toBe('2026-10-24');
    expect(days.at(-1)).toBe('2026-11-21');
    expect(days.some(isSunday)).toBe(false);
    expect(days).not.toContain(TODAY);
    expect(days).not.toContain('2026-10-25');
    expect(days).toHaveLength(25);
  });
});

describe('validateContact', () => {
  it('accepts a name and a phone number alone', () => {
    expect(validateContact(contact)).toEqual({});
  });

  it('asks for the name and the phone', () => {
    expect(validateContact({ ...contact, fullName: '  ', phone: '' })).toEqual({ fullName: 'required', phone: 'required' });
  });

  it('refuses a one-letter name, angle brackets, a short phone and a bad e-mail', () => {
    expect(validateContact({ ...contact, fullName: 'A' }).fullName).toBe('invalid');
    expect(validateContact({ ...contact, fullName: 'Amine <b>' }).fullName).toBe('invalid');
    expect(validateContact({ ...contact, phone: '12 34' }).phone).toBe('invalid');
    expect(validateContact({ ...contact, phone: 'abc def ghi' }).phone).toBe('invalid');
    expect(validateContact({ ...contact, email: 'nope' }).email).toBe('invalid');
    expect(validateContact({ ...contact, email: 'a@b.co?bcc=x@evil.com' }).email).toBe('invalid');
    expect(validateContact({ ...contact, fullName: 'Amine ' + String.fromCharCode(0x202e) + 'Ben' }).fullName).toBe('invalid');
    expect(validateContact({ ...contact, email: 'amine.ben+tn@mail-box.example.tn' })).toEqual({});
    expect(validateContact({ ...contact, message: 'x'.repeat(2001) }).message).toBe('invalid');
  });
});

describe('validateRental', () => {
  it('accepts today, a year ahead and 1 to 120 months', () => {
    expect(isValid(validateRental({ startDate: TODAY, months: 12 }, TODAY))).toBe(true);
    expect(isValid(validateRental({ startDate: '2027-10-23', months: 120 }, TODAY))).toBe(true);
    expect(isValid(validateRental({ startDate: TODAY, months: 1 }, TODAY))).toBe(true);
  });

  it('refuses the past, more than a year ahead, an impossible date and a bad duration', () => {
    expect(validateRental({ startDate: '2026-10-22', months: 12 }, TODAY).startDate).toBe('invalid');
    expect(validateRental({ startDate: '2027-10-24', months: 12 }, TODAY).startDate).toBe('invalid');
    expect(validateRental({ startDate: '2026-02-30', months: 12 }, TODAY).startDate).toBe('invalid');
    expect(validateRental({ startDate: '', months: 12 }, TODAY).startDate).toBe('required');
    expect(validateRental({ startDate: TODAY, months: 0 }, TODAY).months).toBe('invalid');
    expect(validateRental({ startDate: TODAY, months: 121 }, TODAY).months).toBe('invalid');
    expect(validateRental({ startDate: TODAY, months: 1.5 }, TODAY).months).toBe('invalid');
  });
});

describe('validateVisit', () => {
  it('accepts a bookable day and slot', () => {
    expect(isValid(validateVisit({ date: '2026-10-24', time: '10:30' }, TODAY))).toBe(true);
  });

  it('refuses today, a Sunday, a quarter-hour and an evening slot', () => {
    expect(validateVisit({ date: TODAY, time: '10:30' }, TODAY).date).toBe('invalid');
    expect(validateVisit({ date: '2026-10-25', time: '10:30' }, TODAY).date).toBe('invalid');
    expect(validateVisit({ date: '2026-10-24', time: '10:15' }, TODAY).time).toBe('invalid');
    expect(validateVisit({ date: '2026-10-24', time: '18:00' }, TODAY).time).toBe('invalid');
    expect(validateVisit({ date: '', time: '' }, TODAY)).toEqual({ date: 'required', time: 'required' });
  });
});

describe('requestErrorCode', () => {
  it('reads the code the database function raised', () => {
    expect(requestErrorCode('check constraint: REQUEST_SLOT_TAKEN')).toBe('slot_taken');
    expect(requestErrorCode('REQUEST_TOO_MANY')).toBe('too_many');
    expect(requestErrorCode('REQUEST_DUPLICATE')).toBe('duplicate');
    expect(requestErrorCode('REQUEST_NOT_FOR_RENT')).toBe('not_for_rent');
    expect(requestErrorCode('REQUEST_UNIT_UNAVAILABLE')).toBe('unavailable');
    expect(requestErrorCode('REQUEST_INVALID')).toBe('invalid');
    expect(requestErrorCode('boom')).toBe('unknown');
  });
});
