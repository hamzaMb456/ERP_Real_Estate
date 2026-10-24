// Integration: batch 3 (leases) through the dispatcher on Floci.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from '../domain/test-env.ts';

const ready = await useDevTables();
const { doc, table } = await import('../domain/db.ts');
const { dispatch } = await import('./dispatch.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const [PROPERTY, U1, U2, RENTER] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const manager = { role: 'manager', userId: 'u1', orgId: ORG };
const call = async (field: 'run' | 'exec', op: string, variables: Record<string, unknown>) =>
  JSON.parse(await dispatch(field, { op, variables: JSON.stringify(variables) }, manager));
const put = (model: string, item: Record<string, unknown>) =>
  doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: 'x', updated_at: 'x', ...item } }));

before(async () => {
  if (!ready) return;
  await put('Property', { id: PROPERTY, organization_id: ORG, branch_id: 'B', name: 'Résidence D' });
  await put('Unit', { id: U1, organization_id: ORG, property_id: PROPERTY, code: 'D1', status: 'vacant', rent_amount: 900 });
  await put('Unit', { id: U2, organization_id: ORG, property_id: PROPERTY, code: 'D2', status: 'vacant', rent_amount: 700 });
  await put('Contact', { id: RENTER, organization_id: ORG, full_name: 'Karim Renter', phone: '71 1', roles: [] });
});

test('batch 3: leases', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  const leaseId = randomUUID();
  await call('exec', 'CreateLease', {
    lease: { id: leaseId, start_date: '2026-01-01', end_date: '2026-12-31', payment_day: 5, deposit_amount: 1800 },
    units: [{ lease_id: leaseId, unit_id: U1 }],
    parties: [{ lease_id: leaseId, contact_id: RENTER, role: 'renter' }],
    rents: [{ lease_id: leaseId, unit_id: U1, effective_from: '2026-01-01', rent_amount: 900, charges_amount: 50 }],
  });

  await t.test('draft keeps the client id; form units list vacant + kept units', async () => {
    const draft = (await call('run', 'DraftLease', { id: leaseId })).lease;
    assert.deepEqual([draft.id, draft.status, draft.units, draft.parties[0].role], [leaseId, 'draft', [{ unit_id: U1 }], 'renter']);
    const formUnits = (await call('run', 'LeaseFormUnits', { keep: [] })).units;
    assert.deepEqual(formUnits.map((u: { code: string }) => u.code), ['D1', 'D2']);
  });

  await t.test('update draft replaces units and rents', async () => {
    await call('exec', 'UpdateDraftLease', {
      id: leaseId, set: { payment_day: 10 },
      units: [{ lease_id: leaseId, unit_id: U2 }], parties: [{ lease_id: leaseId, contact_id: RENTER, role: 'renter' }],
      rents: [{ lease_id: leaseId, unit_id: U2, effective_from: '2026-01-01', rent_amount: 700, charges_amount: 0 }],
    });
    const draft = (await call('run', 'DraftLease', { id: leaseId })).lease;
    assert.deepEqual([draft.payment_day, draft.units], [10, [{ unit_id: U2 }]]);
  });

  await t.test('activate, list, fiche, unit lease card, registration', async () => {
    assert.deepEqual((await call('exec', 'ActivateLease', { id: leaseId, signed: '2026-01-02' })).activate_lease, [{ id: leaseId, status: 'active' }]);
    const list = (await call('run', 'Leases', {})).lease_overview;
    assert.deepEqual([list[0].unit_codes, list[0].renter_names, list[0].total_rent], ['D2', 'Karim Renter', 700]);
    const fiche = (await call('run', 'Lease', { id: leaseId })).lease;
    assert.deepEqual([fiche.units[0].unit.code, fiche.parties[0].contact.full_name, fiche.terms[0].kind], ['D2', 'Karim Renter', 'initial']);
    const card = (await call('run', 'UnitLease', { id: U2 })).unit_current_lease;
    assert.equal(card[0].rent_amount, 700);
    await call('exec', 'SaveRegistration', { id: leaseId, on: '2026-01-10', receipt: 'R-1' });
    assert.equal((await call('run', 'Lease', { id: leaseId })).lease.overview.registration_state, 'registered');
  });

  await t.test('rent change, renewal, end', async () => {
    await call('exec', 'ChangeRent', { id: leaseId, unit: U2, on: '2026-07-01', rent: 750, charges: 0, reason: null });
    assert.deepEqual((await call('exec', 'RenewLease', { id: leaseId, end: '2027-12-31', rents: [{ unit_id: U2, rent_amount: 800 }], note: null })).renew_lease, [{ id: leaseId, end_date: '2027-12-31' }]);
    await assert.rejects(call('exec', 'EndLease', { id: leaseId, on: '2099-01-01', reason: null }), /lease_end_in_future/);
  });
});
