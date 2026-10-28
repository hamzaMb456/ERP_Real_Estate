// Integration: the website operations through the dispatcher, against the dev tables on Floci.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from '../domain/test-env.ts';

const ready = await useDevTables();
const { doc, table } = await import('../domain/db.ts');
const { dispatch } = await import('./dispatch.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const anonymous = { role: 'public', userId: '', orgId: '' };
const client = { role: 'user', userId: randomUUID(), orgId: '' };
const listing = (id: string, over: Record<string, unknown>) => ({
  __typename: 'PublicListing', id, unit_id: id, organization_id: ORG, kind: 'rent', title: id, price: 900, unit_status: 'vacant',
  published_at: '2026-01-01T00:00:00Z', photos: [{ storage_file_id: 'f', position: 1 }], ...over,
});
const where = (extra: Record<string, unknown>[] = []) => ({
  _and: [{ organization_id: { _eq: ORG } }, { price: { _is_null: false } }, { unit_status: { _nin: ['sold', 'under_maintenance'] } }, ...extra],
});
const run = async (op: string, variables: Record<string, unknown>, caller = anonymous) =>
  JSON.parse(await dispatch('run', { op, variables: JSON.stringify(variables) }, caller));

before(async () => {
  if (!ready) return;
  const put = (item: Record<string, unknown>) => doc.send(new PutCommand({ TableName: table('PublicListing'), Item: JSON.parse(JSON.stringify(item)) }));
  await put(listing('L1', {
    city: 'Tunis', price: 900, published_at: '2026-03-01T00:00:00Z',
    visit_fee: 30, visit_payment_method: 'virtual', visit_payment_instructions: 'Virement RIB TN59 ...',
  }));
  await put(listing('L2', { city: 'Sfax', price: 1500, published_at: '2026-02-01T00:00:00Z' }));
  await put(listing('L3', { city: 'Tunis', kind: 'sale', price: 200000 }));
  // Every listing has published_at (the unit's created_at): without it the byOrg index would not hold it.
  await put(listing('L4', { city: null, price: 700, published_at: '2026-01-01T00:00:00Z' }));
});

test('website operations', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  await t.test('latest: filtered by kind, recent first with nulls last', async () => {
    const data = await run('PublicLatestListings', { where: where([{ kind: { _eq: 'rent' } }]), orderBy: [{ published_at: 'desc_nulls_last' }, { id: 'asc' }], limit: 10 });
    assert.deepEqual(data.listings.map((l: { id: string }) => l.id), ['L1', 'L2', 'L4']);
  });

  await t.test('search: page, total, cities (no nulls, distinct, sorted)', async () => {
    const data = await run('PublicSearchListings', {
      where: where([{ kind: { _eq: 'rent' } }, { price: { _lte: 1000 } }]),
      citiesWhere: { _and: [...where([{ kind: { _eq: 'rent' } }])._and, { city: { _is_null: false } }] },
      orderBy: [{ price: 'asc' }], limit: 1, offset: 1,
    });
    assert.deepEqual(data.items.map((l: { id: string }) => l.id), ['L1']);
    assert.equal(data.total.aggregate.count, 2);
    assert.deepEqual(data.cities, [{ city: 'Sfax' }, { city: 'Tunis' }]);
  });

  await t.test('without the organization the read is refused; roles and kinds are enforced', async () => {
    await assert.rejects(run('PublicCities', { where: { city: { _is_null: false } } }), /public_org_required/);
    await assert.rejects(run('MyVisits', {}, anonymous), /permission_denied/);
    await assert.rejects(dispatch('exec', { op: 'PublicCities', variables: '{}' }, anonymous), /unknown_operation/);
  });

  await t.test('submit needs a signed-in client', async () => {
    await assert.rejects(
      dispatch('exec', { op: 'SubmitVisitRequest', variables: JSON.stringify({ unit: 'L1', day: '2026-12-01', time: '10:00', name: 'Ali', phone: '71123456' }) }, anonymous),
      /REQUEST_LOGIN_REQUIRED/,
    );
    const mine = await run('MyVisits', {}, client);
    assert.deepEqual(mine.visit_requests, []);
  });

  await t.test('MyUnitRequests: tells the booking card which buttons this client already used', async () => {
    const put = (model: string, item: Record<string, unknown>) =>
      doc.send(new PutCommand({ TableName: table(model), Item: { __typename: model, created_at: '2026-10-01T00:00:00Z', ...item } }));
    await put('RentalRequest', {
      id: randomUUID(), organization_id: ORG, client_user_id: client.userId, unit_id: 'L1',
      start_date: '2026-11-01', duration_months: 12, full_name: 'C', phone: '71000000', status: 'new',
    });
    await put('VisitRequest', {
      id: randomUUID(), organization_id: ORG, client_user_id: client.userId, unit_id: 'L4',
      visit_date: '2026-11-01', visit_time: '10:00:00', full_name: 'C', phone: '71000000', status: 'new',
    });

    assert.deepEqual(await run('MyUnitRequests', { unit: 'L1' }, client), { has_rental_request: true, has_visit_request: false });
    assert.deepEqual(await run('MyUnitRequests', { unit: 'L4' }, client), { has_rental_request: false, has_visit_request: true });
    assert.deepEqual(await run('MyUnitRequests', { unit: 'L2' }, client), { has_rental_request: false, has_visit_request: false });
    await assert.rejects(run('MyUnitRequests', { unit: 'L1' }, anonymous), /permission_denied/);
  });

  await t.test('ListingsFor: fee and payment instructions for the client to see once confirmed', async () => {
    const data = await run('ListingsFor', { ids: ['L1', 'L4'] }, client);
    assert.deepEqual(data.public_listings.find((l: { unit_id: string }) => l.unit_id === 'L1'), {
      unit_id: 'L1', title: 'L1', city: 'Tunis', visit_fee: 30, visit_payment_method: 'virtual', visit_payment_instructions: 'Virement RIB TN59 ...',
    });
    assert.deepEqual(data.public_listings.find((l: { unit_id: string }) => l.unit_id === 'L4'), {
      unit_id: 'L4', title: 'L4', city: null, visit_fee: null, visit_payment_instructions: null,
    });
  });
});
