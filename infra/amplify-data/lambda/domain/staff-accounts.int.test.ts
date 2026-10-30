// Integration: regional staff records, invitations and the trail against the dev tables on Floci (fresh org per run).
// Needs the StaffInvitation and StaffActivity tables, i.e. a dev deploy of this change.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from './test-env.ts';

let ready = await useDevTables();
const { doc, table, getItem, queryAll } = await import('./db.ts');
const accounts = await import('./staff-accounts.ts');
const { confirmationProof, signToken } = await import('./staff-invitations.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

// The staff tables only exist after a dev deploy of this change: skip (not fail) until then.
if (ready) {
  try {
    await getItem('StaffInvitation', { id: 'probe' });
    await getItem('StaffActivity', { id: 'probe' });
  } catch {
    ready = false;
  }
}

const ORG = randomUUID();
const ADMIN = randomUUID();
const B1 = randomUUID();
const B2 = randomUUID();
const STAFF = randomUUID();
const SECRET = 'integration-secret';
const env = { INVITE_SECRET: SECRET };
const manager = { role: 'manager', userId: ADMIN, orgId: ORG };

const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: '2026-01-01T00:00:00Z', ...item } }));
const code = async (p: Promise<unknown>): Promise<string> => {
  try { await p; } catch (err) { return (err as { code?: string }).code ?? (err as Error).message; }
  return 'no error';
};
/** The link the mailer would send for an invitation row. */
const linkFor = async (invitationId: string): Promise<string> => {
  const row = (await getItem('StaffInvitation', { id: invitationId })) as { id: string; expires_at: string };
  return signToken(SECRET, row.id, row.expires_at);
};

before(async () => {
  if (!ready) return;
  await put('Branch', { id: B1, organization_id: ORG, name: 'Aouina' });
  await put('Branch', { id: B2, organization_id: ORG, name: 'Bizerte' });
});

test('staff account records', { skip: !ready && 'Floci dev tables (with the staff tables) not reachable' }, async (t) => {
  let first = '';
  await t.test('creating a record writes the member, the agency, an open invitation and two trail rows', async () => {
    first = (await accounts.createStaffRecord(manager, { user_id: STAFF, email: 'amel@agence.tn', display_name: 'Amel', branch_ids: [B1] })).invitation_id;
    const member = await getItem('StaffMember', { id: STAFF });
    assert.equal(member?.role, 'staff');
    assert.equal(accounts.staffStatus(member ?? {}), 'invited');
    const assigned = await queryAll('StaffAssignment', { index: 'byUser', key: 'user_id', value: STAFF });
    assert.deepEqual(assigned.map((a) => a.branch_id), [B1]);
    const trail = (await accounts.listStaffActivity(manager)).filter((r) => r.user_id === STAFF).map((r) => r.kind).sort();
    assert.deepEqual(trail, ['created', 'invited']);
  });

  await t.test('the link checks out and names the person', async () => {
    const found = await accounts.checkInvitation(env, await linkFor(first));
    assert.deepEqual(found, { ok: true, user_id: STAFF, organization_id: ORG, email: 'amel@agence.tn', display_name: 'Amel' });
  });

  await t.test('an unknown branch is refused and nothing is written', async () => {
    const other = randomUUID();
    assert.equal(await code(accounts.createStaffRecord(manager, { user_id: other, email: 'x@y.tn', display_name: 'X', branch_ids: [randomUUID()] })), 'branch_not_found');
    assert.equal(await getItem('StaffMember', { id: other }), undefined);
  });

  let second = '';
  await t.test('resending revokes the first link', async () => {
    const oldLink = await linkFor(first);
    second = (await accounts.resendInvitation(manager, STAFF)).invitation_id;
    assert.deepEqual(await accounts.checkInvitation(env, oldLink), { ok: false });
    assert.equal((await accounts.checkInvitation(env, await linkFor(second))).ok, true);
  });

  await t.test('confirming uses the link up and marks the member confirmed', async () => {
    const link = await linkFor(second);
    assert.deepEqual(await accounts.confirmActivation(env, link, ''), { ok: false });
    assert.equal(accounts.staffStatus((await getItem('StaffMember', { id: STAFF })) ?? {}), 'invited');
    const proof = confirmationProof(SECRET, second);
    assert.deepEqual(await accounts.confirmActivation(env, link, proof), { ok: true });
    assert.deepEqual(await accounts.confirmActivation(env, link, proof), { ok: false });
    assert.equal(accounts.staffStatus((await getItem('StaffMember', { id: STAFF })) ?? {}), 'confirmed');
    assert.equal(await code(accounts.resendInvitation(manager, STAFF)), 'staff_already_confirmed');
  });

  let third = '';
  await t.test('resetting the authenticator reopens the account with a fresh link', async () => {
    third = (await accounts.resetStaffMfa(manager, STAFF)).invitation_id;
    assert.equal(accounts.staffStatus((await getItem('StaffMember', { id: STAFF })) ?? {}), 'invited');
    assert.equal((await accounts.checkInvitation(env, await linkFor(third))).ok, true);
  });

  await t.test('offboarding removes agencies, kills the link and marks the member disabled', async () => {
    const link = await linkFor(third);
    await accounts.offboardStaff(manager, STAFF);
    assert.deepEqual(await queryAll('StaffAssignment', { index: 'byUser', key: 'user_id', value: STAFF }), []);
    assert.deepEqual(await accounts.checkInvitation(env, link), { ok: false });
    assert.equal(accounts.staffStatus((await getItem('StaffMember', { id: STAFF })) ?? {}), 'disabled');
    assert.equal(await code(accounts.resendInvitation(manager, STAFF)), 'staff_disabled');
    const kinds = (await accounts.listStaffActivity(manager)).filter((r) => r.user_id === STAFF).map((r) => r.kind);
    assert.ok(kinds.includes('disabled') && kinds.includes('mfa_reset') && kinds.includes('activated'));
  });
});
