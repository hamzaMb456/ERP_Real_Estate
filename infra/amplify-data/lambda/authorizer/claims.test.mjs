import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheSeconds, toResolverContext } from './claims.mjs';

const NS = 'https://hasura.io/jwt/claims';
const ORG1 = '11111111-1111-4111-8111-111111111111';
const ORG2 = '22222222-2222-4222-8222-222222222222';
const token = (claims, sub = 'user-1') => ({ sub, [NS]: claims });

test('maps a staff token to role, user and org', () => {
  const ctx = toResolverContext(token({ 'x-hasura-default-role': 'manager', 'x-hasura-user-id': 'u1', 'x-hasura-org-id': ORG1 }));
  assert.deepEqual(ctx, { role: 'manager', userId: 'u1', orgId: ORG1 });
});

test('reads claim names case-insensitively and falls back to sub', () => {
  const ctx = toResolverContext(token({ 'X-Hasura-Default-Role': 'viewer', 'X-Hasura-Org-Id': ORG2 }, 'sub-9'));
  assert.deepEqual(ctx, { role: 'viewer', userId: 'sub-9', orgId: ORG2 });
});

test('rejects an org claim that is not a single uuid string', () => {
  for (const orgId of ['org-1', [ORG1], `${ORG1},${ORG2}`, false]) {
    assert.equal(toResolverContext(token({ 'x-hasura-default-role': 'manager', 'x-hasura-org-id': orgId })), null);
  }
});

test('caches no longer than the token lives, capped at 5 minutes', () => {
  assert.equal(cacheSeconds(1_000 + 60, 1_000), 60);
  assert.equal(cacheSeconds(1_000 + 3_600, 1_000), 300);
  assert.equal(cacheSeconds(900, 1_000), 0);
});

test('lets a client (user role) through without an org', () => {
  assert.deepEqual(toResolverContext(token({ 'x-hasura-default-role': 'user' })), { role: 'user', userId: 'user-1', orgId: '' });
});

test('rejects staff without an org, unknown roles and missing claims', () => {
  assert.equal(toResolverContext(token({ 'x-hasura-default-role': 'org_admin' })), null);
  assert.equal(toResolverContext(token({ 'x-hasura-default-role': 'admin', 'x-hasura-org-id': 'o' })), null);
  assert.equal(toResolverContext({ sub: 'x' }), null);
  assert.equal(toResolverContext(undefined), null);
});
