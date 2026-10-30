import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INVITATION_TTL_HOURS, checkToken, confirmationProof, newInvitation, proofMatches, signToken } from './staff-invitations.ts';

const SECRET = 'test-secret-1';
const NOW = new Date('2026-10-30T10:00:00.000Z');
const HOUR = 3_600_000;

const fresh = () => {
  const { id, expires_at } = newInvitation(NOW);
  return { row: { id, expires_at }, token: signToken(SECRET, id, expires_at) };
};

test('a fresh token checks out', () => {
  const { row, token } = fresh();
  assert.deepEqual(checkToken(SECRET, token, row, NOW), { ok: true, id: row.id });
});

test('expires after 24 hours', () => {
  const { row, token } = fresh();
  assert.equal(INVITATION_TTL_HOURS, 24);
  assert.equal(new Date(row.expires_at).getTime() - NOW.getTime(), 24 * HOUR);
  assert.equal(checkToken(SECRET, token, row, new Date(NOW.getTime() + 24 * HOUR - 1000)).ok, true);
  assert.equal(checkToken(SECRET, token, row, new Date(NOW.getTime() + 24 * HOUR + 1000)).ok, false);
});

test('a used or revoked invitation fails', () => {
  const { row, token } = fresh();
  assert.equal(checkToken(SECRET, token, { ...row, used_at: '2026-10-30T11:00:00.000Z' }, NOW).ok, false);
  assert.equal(checkToken(SECRET, token, { ...row, revoked_at: '2026-10-30T11:00:00.000Z' }, NOW).ok, false);
});

test('a tampered signature fails', () => {
  const { row, token } = fresh();
  const flipped = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
  assert.equal(checkToken(SECRET, flipped, row, NOW).ok, false);
});

test('a token signed with another secret fails', () => {
  const { row, token } = fresh();
  assert.equal(checkToken('another-secret', token, row, NOW).ok, false);
});

test('the signature covers the expiry stored on the row', () => {
  const { row, token } = fresh();
  const stretched = { ...row, expires_at: new Date(NOW.getTime() + 999 * HOUR).toISOString() };
  assert.equal(checkToken(SECRET, token, stretched, NOW).ok, false);
});

test('a malformed token or a missing row fails', () => {
  const { row, token } = fresh();
  assert.equal(checkToken(SECRET, 'nonsense', row, NOW).ok, false);
  assert.equal(checkToken(SECRET, '', row, NOW).ok, false);
  assert.equal(checkToken(SECRET, token, undefined, NOW).ok, false);
  assert.equal(checkToken('', token, row, NOW).ok, false);
});

test('every failure is the same value', () => {
  const { row, token } = fresh();
  const failures = [
    checkToken(SECRET, token, row, new Date(NOW.getTime() + 25 * HOUR)),
    checkToken(SECRET, token, { ...row, used_at: 'x' }, NOW),
    checkToken(SECRET, token, { ...row, revoked_at: 'x' }, NOW),
    checkToken(SECRET, token.slice(0, -2) + 'zz', row, NOW),
    checkToken(SECRET, token, undefined, NOW),
  ];
  for (const failure of failures) assert.deepEqual(failure, { ok: false });
});

test('the confirmation proof is stable per invitation and secret', () => {
  assert.equal(confirmationProof(SECRET, 'inv-1'), confirmationProof(SECRET, 'inv-1'));
  assert.notEqual(confirmationProof(SECRET, 'inv-1'), confirmationProof(SECRET, 'inv-2'));
  assert.notEqual(confirmationProof(SECRET, 'inv-1'), confirmationProof('another-secret', 'inv-1'));
});

test('only the right proof for the right invitation is accepted', () => {
  const proof = confirmationProof(SECRET, 'inv-1');
  assert.equal(proofMatches(SECRET, 'inv-1', proof), true);
  assert.equal(proofMatches(SECRET, 'inv-2', proof), false);
  assert.equal(proofMatches('another-secret', 'inv-1', proof), false);
  assert.equal(proofMatches(SECRET, 'inv-1', ''), false);
  assert.equal(proofMatches(SECRET, 'inv-1', proof.slice(0, -1)), false);
  assert.equal(proofMatches('', 'inv-1', proof), false);
});

test('a signed link token is not a proof, and a proof is not a link token', () => {
  const { id, expires_at } = newInvitation(NOW);
  assert.notEqual(signToken(SECRET, id, expires_at).split('.')[1], confirmationProof(SECRET, id));
});
