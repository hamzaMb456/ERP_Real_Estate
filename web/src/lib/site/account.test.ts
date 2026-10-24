import { describe, expect, it } from 'vitest';
import { accountErrorKey, accountHref, isStaffRole, safeSiteNext, validateAccount } from './account';

describe('isStaffRole', () => {
  it('knows the ERP roles and not the client role', () => {
    expect(isStaffRole('org_admin')).toBe(true);
    expect(isStaffRole('manager')).toBe(true);
    expect(isStaffRole('viewer')).toBe(true);
    expect(isStaffRole('user')).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
    expect(isStaffRole(null)).toBe(false);
  });
});

describe('safeSiteNext', () => {
  const ID = '70712abb-68cb-41d4-a655-598b41e43b2a';
  it('keeps pages of the public site', () => {
    expect(safeSiteNext(`/logement/${ID}`)).toBe(`/logement/${ID}`);
    expect(safeSiteNext('/favoris')).toBe('/favoris');
    expect(safeSiteNext('/louer?ville=Tunis&page=2')).toBe('/louer?ville=Tunis&page=2');
  });

  it('sends everything else home: the ERP, other sites, tricks', () => {
    for (const bad of ['/erp', '/erp/biens', '//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', '/compte/connexion', '', null, undefined]) {
      expect(safeSiteNext(bad), String(bad)).toBe('/');
    }
  });
});

describe('accountHref', () => {
  it('adds the way back only when there is one', () => {
    expect(accountHref('/compte/connexion')).toBe('/compte/connexion');
    expect(accountHref('/compte/inscription', '/favoris')).toBe('/compte/inscription?next=%2Ffavoris');
    expect(accountHref('/compte/connexion', '/erp')).toBe('/compte/connexion');
  });
});

describe('accountErrorKey', () => {
  it('maps Nhost codes to wording keys', () => {
    expect(accountErrorKey('email-already-in-use')).toBe('emailTaken');
    expect(accountErrorKey('password-in-hibp-database')).toBe('weak');
    expect(accountErrorKey('invalid-email')).toBe('invalid');
    expect(accountErrorKey('signup-disabled')).toBe('disabled');
    expect(accountErrorKey('anything-else')).toBe('other');
    expect(accountErrorKey(undefined)).toBe('other');
  });
});

describe('validateAccount', () => {
  it('sign-in needs an e-mail and a password only', () => {
    expect(validateAccount({ name: '', email: 'a@b.tn', password: 'x' }, 'signin')).toEqual({});
    expect(validateAccount({ name: '', email: '', password: '' }, 'signin')).toEqual({ email: 'required', password: 'required' });
    expect(validateAccount({ name: '', email: 'nope', password: 'x' }, 'signin').email).toBe('email');
  });

  it('sign-up also needs a name and 8 characters', () => {
    expect(validateAccount({ name: 'A', email: 'a@b.tn', password: '1234567' }, 'signup')).toEqual({ name: 'required', password: 'short' });
    expect(validateAccount({ name: 'Amine', email: 'a@b.tn', password: '12345678' }, 'signup')).toEqual({});
  });
});
