import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withInviteSecret } from './invite-secret.mjs';

test('adds a new secret and keeps every other key', () => {
  const next = withInviteSecret({ SMTP_HOST: 'h', APP_URL: 'https://x' }, () => 'fresh');
  assert.deepEqual(next, { SMTP_HOST: 'h', APP_URL: 'https://x', INVITE_SECRET: 'fresh' });
});

test('leaves an existing secret alone, so links already sent keep working', () => {
  const next = withInviteSecret({ INVITE_SECRET: 'old', APP_URL: 'https://x' }, () => 'fresh');
  assert.equal(next.INVITE_SECRET, 'old');
});

test('replaces the secret when asked to rotate', () => {
  const next = withInviteSecret({ INVITE_SECRET: 'old' }, () => 'fresh', { rotate: true });
  assert.equal(next.INVITE_SECRET, 'fresh');
});

test('does not change the object it was given', () => {
  const current = { A: '1' };
  withInviteSecret(current, () => 'x');
  assert.deepEqual(current, { A: '1' });
});

test('a generated secret is long and random', async () => {
  const { generateInviteSecret } = await import('./invite-secret.mjs');
  const a = generateInviteSecret();
  assert.ok(a.length >= 40);
  assert.notEqual(a, generateInviteSecret());
});

test('an env file gets the line added, or replaced in place, keeping every other line', async () => {
  const { withEnvLine } = await import('./invite-secret.mjs');
  assert.equal(withEnvLine('A=1\nB=2\n', 'STAFF_INVITE_SECRET', 'x'), 'A=1\nB=2\nSTAFF_INVITE_SECRET=x\n');
  assert.equal(withEnvLine('A=1\nSTAFF_INVITE_SECRET=old\nB=2\n', 'STAFF_INVITE_SECRET', 'new'), 'A=1\nSTAFF_INVITE_SECRET=new\nB=2\n');
  assert.equal(withEnvLine('A=1', 'STAFF_INVITE_SECRET', 'x'), 'A=1\nSTAFF_INVITE_SECRET=x\n');
  assert.equal(withEnvLine('A=1\r\nB=2\r\n', 'C', 'x'), 'A=1\r\nB=2\r\nC=x\r\n');
});
