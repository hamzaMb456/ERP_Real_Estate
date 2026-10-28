import { describe, expect, it } from 'vitest';
import { resetErrorKey, validateNewPassword, validateResetEmail } from './password-reset';

describe('validateResetEmail', () => {
  it('asks for an address when it is empty', () => {
    expect(validateResetEmail('   ')).toBe('required');
  });

  it('rejects a malformed address', () => {
    expect(validateResetEmail('nobody@')).toBe('email');
    expect(validateResetEmail('no spaces@x.tn')).toBe('email');
  });

  it('accepts a well-formed address, ignoring surrounding spaces', () => {
    expect(validateResetEmail('  hamza@example.tn ')).toBeNull();
  });
});

describe('validateNewPassword', () => {
  const ok = { code: '123456', password: 'Abcdef12', confirm: 'Abcdef12' };

  it('accepts a 6-digit code with a strong, matching password', () => {
    expect(validateNewPassword(ok)).toEqual({});
  });

  it('requires the code and accepts only 6 digits', () => {
    expect(validateNewPassword({ ...ok, code: '' }).code).toBe('required');
    expect(validateNewPassword({ ...ok, code: '12345' }).code).toBe('code');
    expect(validateNewPassword({ ...ok, code: '12a456' }).code).toBe('code');
    expect(validateNewPassword({ ...ok, code: ' 123456 ' }).code).toBeUndefined();
  });

  it('requires 8+ characters with upper case, lower case and a digit', () => {
    for (const weak of ['Abc12', 'abcdefg1', 'ABCDEFG1', 'Abcdefgh']) {
      expect(validateNewPassword({ ...ok, password: weak, confirm: weak }).password).toBe('weak');
    }
    expect(validateNewPassword({ ...ok, password: '', confirm: '' }).password).toBe('required');
  });

  it('flags a confirmation that differs', () => {
    expect(validateNewPassword({ ...ok, confirm: 'Abcdef13' }).confirm).toBe('mismatch');
  });
});

describe('resetErrorKey', () => {
  it('maps Cognito codes to a wording key', () => {
    expect(resetErrorKey('CodeMismatchException')).toBe('badCode');
    expect(resetErrorKey('ExpiredCodeException')).toBe('expiredCode');
    expect(resetErrorKey('InvalidPasswordException')).toBe('weak');
    expect(resetErrorKey('LimitExceededException')).toBe('tooMany');
    expect(resetErrorKey('TooManyRequestsException')).toBe('tooMany');
    expect(resetErrorKey('TooManyFailedAttemptsException')).toBe('tooMany');
    expect(resetErrorKey('invalid-request')).toBe('invalid');
    expect(resetErrorKey('unreachable')).toBe('unreachable');
  });

  it('falls back to a generic key', () => {
    expect(resetErrorKey('SomethingElse')).toBe('other');
    expect(resetErrorKey(undefined)).toBe('other');
  });
});
