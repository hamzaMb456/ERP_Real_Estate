import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totp } from './totp.mjs';

// RFC 6238 test secret: ASCII "12345678901234567890", base32 = GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ.
const SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('RFC 6238 vector at 59 seconds, 8 digits', () => {
  assert.equal(totp(SECRET, 59, 8), '94287082');
});

test('RFC 6238 vector at 1111111109 seconds, 8 digits', () => {
  assert.equal(totp(SECRET, 1111111109, 8), '07081804');
});

test('default is 6 digits', () => {
  assert.equal(totp(SECRET, 59), '287082');
});

test('the code changes with the 30 second step', () => {
  assert.notEqual(totp(SECRET, 59), totp(SECRET, 60));
  assert.equal(totp(SECRET, 30), totp(SECRET, 59));
});

test('lowercase and spaced secrets are accepted (authenticator apps show them grouped)', () => {
  assert.equal(totp('gezd gnbv gy3t qojq gezd gnbv gy3t qojq', 59), '287082');
});
