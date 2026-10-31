import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from './dispatch.ts';
import type { Op } from './registry.ts';

const ORG = '11111111-1111-4111-8111-111111111111';
const op: Op = { kind: 'query', roles: ['manager', 'viewer'], run: async () => ({ ran: true }) };
const ops = { Probe: op };
const args = { op: 'Probe', variables: '{}' };
const caller = (role: string) => ({ role, userId: 'u-1', orgId: ORG });

test('a role listed by the operation runs it', async () => {
  const result = await dispatch('run', args, caller('viewer'), ops);
  assert.equal(result, JSON.stringify({ ran: true }));
});

test('a role not listed by the operation is refused before it runs', async () => {
  let ran = false;
  const guarded = { Probe: { ...op, run: async () => { ran = true; return {}; } } };
  await assert.rejects(dispatch('run', args, caller('user'), guarded), /permission_denied/);
  assert.equal(ran, false);
});

test('an unknown operation or the wrong field kind is refused', async () => {
  await assert.rejects(dispatch('exec', args, caller('manager'), ops), /unknown_operation:Probe/);
  await assert.rejects(dispatch('run', { op: 'Missing' }, caller('manager'), ops), /unknown_operation:Missing/);
});
