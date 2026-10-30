import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Caller } from './auth.ts';
import { confirmationProof } from './staff-invitations.ts';
import {
  assertActiveStaff,
  checkInvitation,
  confirmActivation,
  createStaffRecord,
  listStaffActivity,
  lookupStaff,
  offboardStaff,
  resendInvitation,
  resetStaffMfa,
  staffStatus,
} from './staff-accounts.ts';

const ORG = '11111111-1111-4111-8111-111111111111';
const as = (role: string): Caller => ({ role, userId: 'actor-1', orgId: ORG });
const INPUT = { user_id: 'u-1', email: 'a@b.tn', display_name: 'Amel', branch_ids: [] };

const code = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (error) {
    return (error as { code: string }).code;
  }
  return 'no error';
};

test('only a manager or org_admin may create a staff record', async () => {
  for (const role of ['staff', 'viewer', 'user', 'public']) {
    assert.equal(await code(() => createStaffRecord(as(role), INPUT)), 'permission_denied', role);
  }
});

test('only a manager or org_admin may resend, offboard, reset or read the trail', async () => {
  for (const role of ['staff', 'viewer', 'user']) {
    assert.equal(await code(() => resendInvitation(as(role), 'u-1')), 'permission_denied', `resend ${role}`);
    assert.equal(await code(() => offboardStaff(as(role), 'u-1')), 'permission_denied', `offboard ${role}`);
    assert.equal(await code(() => resetStaffMfa(as(role), 'u-1')), 'permission_denied', `reset ${role}`);
    assert.equal(await code(() => listStaffActivity(as(role))), 'permission_denied', `trail ${role}`);
  }
});

test('creation refuses an empty email or name before touching the database', async () => {
  assert.equal(await code(() => createStaffRecord(as('manager'), { ...INPUT, email: '  ' })), 'staff_email_required');
  assert.equal(await code(() => createStaffRecord(as('manager'), { ...INPUT, email: 'no-at-sign' })), 'staff_email_required');
  assert.equal(await code(() => createStaffRecord(as('manager'), { ...INPUT, display_name: '' })), 'staff_name_required');
});

test('an invitation check answers { ok: false } when the secret or the token is missing', async () => {
  assert.deepEqual(await checkInvitation({}, 'anything.at-all'), { ok: false });
  assert.deepEqual(await checkInvitation({ INVITE_SECRET: 's' }, ''), { ok: false });
  assert.deepEqual(await checkInvitation({ INVITE_SECRET: 's' }, 'no-dot'), { ok: false });
});

test('the status of a staff member', () => {
  assert.equal(staffStatus({}), 'invited');
  assert.equal(staffStatus({ confirmed_at: '2026-10-30T10:00:00.000Z' }), 'confirmed');
  assert.equal(staffStatus({ disabled_at: '2026-10-30T10:00:00.000Z' }), 'disabled');
  assert.equal(staffStatus({ confirmed_at: 'x', disabled_at: 'y' }), 'disabled');
});

test('looking up a staff member is manager only', async () => {
  for (const role of ['staff', 'viewer', 'user']) {
    assert.equal(await code(() => lookupStaff(as(role), 'u-1')), 'permission_denied', role);
  }
});

const staffCaller = { role: 'staff', userId: 'u-1', orgId: ORG };
const lookupOf = (member: Record<string, unknown> | undefined) => async () => member;

test('an active staff member passes the check', async () => {
  await assert.doesNotReject(assertActiveStaff(staffCaller, lookupOf({ id: 'u-1', organization_id: ORG, role: 'staff', confirmed_at: 'x', disabled_at: null })));
});

test('a disabled, missing or foreign staff member is refused', async () => {
  const refused = (member: Record<string, unknown> | undefined) => code(() => assertActiveStaff(staffCaller, lookupOf(member)));
  assert.equal(await refused({ id: 'u-1', organization_id: ORG, role: 'staff', disabled_at: '2026-10-30T10:00:00.000Z' }), 'permission_denied');
  assert.equal(await refused(undefined), 'permission_denied');
  assert.equal(await refused({ id: 'u-1', organization_id: 'another-org', role: 'staff', disabled_at: null }), 'permission_denied');
});

test('the check leaves every other role alone and does not look anything up', async () => {
  let looked = 0;
  const lookup = async () => { looked += 1; return undefined; };
  for (const role of ['manager', 'org_admin', 'viewer', 'user', 'public']) await assertActiveStaff({ ...staffCaller, role }, lookup);
  assert.equal(looked, 0);
});

test('confirming needs the proof only the servers can compute, and checks it before touching the database', async () => {
  const env = { INVITE_SECRET: 's' };
  const token = 'inv-1.signature';
  assert.deepEqual(await confirmActivation(env, token, ''), { ok: false });
  assert.deepEqual(await confirmActivation(env, token, 'not-the-proof'), { ok: false });
  assert.deepEqual(await confirmActivation({}, token, confirmationProof('s', 'inv-1')), { ok: false });
});
