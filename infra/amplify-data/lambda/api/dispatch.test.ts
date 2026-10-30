import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dispatch } from './dispatch.ts';
import type { Op } from './registry.ts';

const ORG = '11111111-1111-4111-8111-111111111111';
const op: Op = { kind: 'query', roles: ['staff', 'manager'], run: async () => ({ ran: true }) };
const ops = { Probe: op };
const args = { op: 'Probe', variables: '{}' };
const caller = (role: string) => ({ role, userId: 'u-1', orgId: ORG });

test('a staff caller runs only after the active-staff check passes', async () => {
  const seen: string[] = [];
  const result = await dispatch('run', args, caller('staff'), ops, async (c) => { seen.push(c.userId); });
  assert.equal(result, JSON.stringify({ ran: true }));
  assert.deepEqual(seen, ['u-1']);
});

test('a staff caller whose check fails never reaches the operation', async () => {
  let ran = false;
  const guarded = { Probe: { ...op, run: async () => { ran = true; return {}; } } };
  await assert.rejects(
    dispatch('run', args, caller('staff'), guarded, async () => { throw Object.assign(new Error('permission_denied'), { code: 'permission_denied' }); }),
    /permission_denied/,
  );
  assert.equal(ran, false);
});

test('other roles are not checked', async () => {
  let checked = 0;
  await dispatch('run', args, caller('manager'), ops, async () => { checked += 1; });
  assert.equal(checked, 0);
});
