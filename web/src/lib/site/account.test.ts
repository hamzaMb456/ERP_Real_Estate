import { describe, expect, it } from 'vitest';
import { accountErrorKey, accountHref, isOrgRole, safeSiteNext, validateAccount } from './account';

describe('isOrgRole', () => {
  it('knows the ERP roles and not the client role', () => {
    expect(isOrgRole('org_admin')).toBe(true);
    expect(isOrgRole('manager')).toBe(true);
    expect(isOrgRole('viewer')).toBe(true);
    expect(isOrgRole('user')).toBe(false);
    expect(isOrgRole(undefined)).toBe(false);
    expect(isOrgRole(null)).toBe(false);
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
  it('maps Cognito codes to wording keys', () => {
    expect(accountErrorKey('UsernameExistsException')).toBe('emailTaken');
    expect(accountErrorKey('InvalidPasswordException')).toBe('weak');
    expect(accountErrorKey('InvalidParameterException')).toBe('invalid');
    expect(accountErrorKey('NotAuthorizedException')).toBe('invalid');
    expect(accountErrorKey('CodeMismatchException')).toBe('invalid');
    expect(accountErrorKey('ExpiredCodeException')).toBe('invalid');
    expect(accountErrorKey('invalid-request')).toBe('invalid');
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
