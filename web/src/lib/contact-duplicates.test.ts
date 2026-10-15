import { describe, expect, it } from 'vitest';
import { duplicateWhere, findDuplicates, formatTnPhone, normalizePhone, type DuplicateCandidate } from './contact-duplicates';

const hedi: DuplicateCandidate = {
  id: 'c1',
  full_name: 'Hédi Ben Salem',
  national_id: '08942155',
  email: 'Hedi.BenSalem@example.tn',
  phone: '+216 20 000 001',
};

describe('normalizePhone / formatTnPhone', () => {
  it('keeps the 8 local digits whatever the spacing or prefix', () => {
    expect(normalizePhone('+216 20 000 001')).toBe('20000001');
    expect(normalizePhone('20 000 001')).toBe('20000001');
    expect(normalizePhone('0021620000001')).toBe('20000001');
    expect(normalizePhone(null)).toBe('');
  });
  it('formats 8 digits as 2-3-3', () => {
    expect(formatTnPhone('20000001')).toBe('20 000 001');
  });
});

describe('findDuplicates', () => {
  it('matches on phone typed differently', () => {
    const matches = findDuplicates({ national_id: '', email: '', phone: '20000001' }, [hedi]);
    expect(matches).toEqual([{ contact: hedi, fields: ['phone'] }]);
  });
  it('matches e-mail without case and lists every matching field', () => {
    const matches = findDuplicates({ national_id: '08942155', email: 'hedi.bensalem@example.tn', phone: '' }, [hedi]);
    expect(matches[0].fields).toEqual(['national_id', 'email']);
  });
  it('ignores the contact being edited and empty inputs', () => {
    expect(findDuplicates({ national_id: '08942155', email: '', phone: '' }, [hedi], 'c1')).toEqual([]);
    expect(findDuplicates({ national_id: '', email: '', phone: '' }, [hedi])).toEqual([]);
  });
});

describe('duplicateWhere', () => {
  it('builds an _or filter only for filled fields', () => {
    expect(duplicateWhere({ national_id: '', email: '', phone: '' })).toBeNull();
    expect(duplicateWhere({ national_id: ' 08942155 ', email: '', phone: '20 000 001' })).toEqual({
      _or: [{ national_id: { _ilike: '08942155' } }, { phone: { _ilike: '%2%0%0%0%0%0%0%1' } }],
    });
  });
});
