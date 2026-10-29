// Integration: the signed-in client's own space (saved searches, hidden listings, recently viewed)
// through the dispatcher on Floci. Every op must stay inside one client: another client's ids are
// "not found", never readable or writable.
import { before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { useDevTables } from '../domain/test-env.ts';

const ready = await useDevTables();
const { doc, table } = await import('../domain/db.ts');
const { dispatch } = await import('./dispatch.ts');
const { PutCommand } = await import('@aws-sdk/lib-dynamodb');

const ORG = randomUUID();
const CLIENT_A = { role: 'user', userId: randomUUID(), orgId: '' };
const CLIENT_B = { role: 'user', userId: randomUUID(), orgId: '' };
const STAFF = { role: 'manager', userId: randomUUID(), orgId: ORG };
const PUBLIC = { role: 'public', userId: '', orgId: '' };

const call = async (field: 'run' | 'exec', op: string, variables: Record<string, unknown>, caller = CLIENT_A) =>
  JSON.parse(await dispatch(field, { op, variables: JSON.stringify(variables) }, caller));

const LISTING_1 = randomUUID();
const LISTING_2 = randomUUID();
const FILTERS = JSON.stringify({ mode: 'rent', cities: ['Tunis'], types: ['apartment'] });

function listingItem(id: string, title: string) {
  return {
    __typename: 'PublicListing',
    id,
    organization_id: ORG,
    unit_id: id,
    kind: 'rent',
    title,
    price: 900,
    unit_status: 'vacant',
    published_at: '2026-10-01T00:00:00Z',
  };
}

before(async () => {
  if (!ready) return;
  await doc.send(new PutCommand({ TableName: table('PublicListing'), Item: listingItem(LISTING_1, 'Appartement A1') }));
  await doc.send(new PutCommand({ TableName: table('PublicListing'), Item: listingItem(LISTING_2, 'Appartement A2') }));
});

test('client space: saved searches, hidden listings, recently viewed', { skip: !ready && 'Floci dev tables not reachable' }, async (t) => {
  await t.test('saved searches: save, list, refuse duplicates of the same filters, delete own only', async () => {
    const created = await call('exec', 'SaveSearch', { label: '  Appartements   Tunis ', filters: FILTERS });
    const row = created.insert_saved_searches_one;
    assert.equal(row.label, 'Appartements Tunis');
    assert.equal(row.filters, FILTERS);

    // Saving the same filters again returns the same row instead of a duplicate.
    const again = await call('exec', 'SaveSearch', { label: 'Autre nom', filters: FILTERS });
    assert.equal(again.insert_saved_searches_one.id, row.id);

    const list = await call('run', 'MySavedSearches', {});
    assert.deepEqual(list.saved_searches.map((s: { id: string }) => s.id), [row.id]);

    // Another client sees nothing of it and cannot delete it.
    assert.deepEqual((await call('run', 'MySavedSearches', {}, CLIENT_B)).saved_searches, []);
    await assert.rejects(call('exec', 'DeleteSavedSearch', { id: row.id }, CLIENT_B), /saved_search_not_found/);

    await call('exec', 'DeleteSavedSearch', { id: row.id });
    assert.deepEqual((await call('run', 'MySavedSearches', {})).saved_searches, []);
  });

  await t.test('saved searches: bad input is refused', async () => {
    await assert.rejects(call('exec', 'SaveSearch', { label: '   ', filters: FILTERS }), /saved_search_label_required/);
    await assert.rejects(call('exec', 'SaveSearch', { label: 'X', filters: 'not json' }), /saved_search_invalid/);
    await assert.rejects(call('exec', 'SaveSearch', { label: 'X', filters: '[1,2]' }), /saved_search_invalid/);
    await assert.rejects(call('exec', 'DeleteSavedSearch', { id: randomUUID() }), /saved_search_not_found/);
  });

  await t.test('hidden listings: hide is idempotent, unknown listing refused, unhide clears', async () => {
    await call('exec', 'HideListing', { listing: LISTING_1 });
    await call('exec', 'HideListing', { listing: LISTING_1 });
    const hidden = await call('run', 'MyHiddenListings', {});
    assert.deepEqual(hidden.hidden_listings.map((h: { listing_id: string }) => h.listing_id), [LISTING_1]);
    assert.deepEqual((await call('run', 'MyHiddenListings', {}, CLIENT_B)).hidden_listings, []);

    await assert.rejects(call('exec', 'HideListing', { listing: randomUUID() }), /listing_not_found/);
    await assert.rejects(call('exec', 'HideListing', { listing: 'not-a-uuid' }), /listing_not_found/);

    // Another client unhiding does not touch this client's row.
    await call('exec', 'UnhideListing', { listing: LISTING_1 }, CLIENT_B);
    assert.equal((await call('run', 'MyHiddenListings', {})).hidden_listings.length, 1);

    await call('exec', 'UnhideListing', { listing: LISTING_1 });
    assert.deepEqual((await call('run', 'MyHiddenListings', {})).hidden_listings, []);
  });

  await t.test('recently viewed: one row per listing, newest first', async () => {
    await call('exec', 'RecordListingView', { listing: LISTING_1 });
    await call('exec', 'RecordListingView', { listing: LISTING_2 });
    await call('exec', 'RecordListingView', { listing: LISTING_1 });
    const viewed = await call('run', 'MyRecentlyViewed', {});
    assert.deepEqual(viewed.recently_viewed.map((v: { listing_id: string }) => v.listing_id), [LISTING_1, LISTING_2]);
    assert.deepEqual((await call('run', 'MyRecentlyViewed', {}, CLIENT_B)).recently_viewed, []);
    await assert.rejects(call('exec', 'RecordListingView', { listing: randomUUID() }), /listing_not_found/);
  });

  await t.test('staff and the anonymous public are refused', async () => {
    for (const caller of [STAFF, PUBLIC]) {
      await assert.rejects(call('run', 'MySavedSearches', {}, caller), /permission_denied/);
      await assert.rejects(call('exec', 'SaveSearch', { label: 'X', filters: FILTERS }, caller), /permission_denied/);
      await assert.rejects(call('run', 'MyRecentlyViewed', {}, caller), /permission_denied/);
      await assert.rejects(call('exec', 'HideListing', { listing: LISTING_1 }, caller), /permission_denied/);
    }
  });
});
