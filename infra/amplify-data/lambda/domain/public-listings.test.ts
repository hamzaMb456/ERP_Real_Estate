import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPublicListing } from './public-listings.ts';

const unit = (over: Record<string, unknown> = {}) => ({
  id: 'U', organization_id: 'O', property_id: 'P', code: 'A1', status: 'vacant', rent_amount: 900, sale_price: 0,
  show_on_website: true, created_at: '2026-01-01T00:00:00Z', ...over,
});
const property = { id: 'P', name: 'Résidence', city: 'Tunis', latitude: 36.80651, longitude: 10.18149 };
const photo = (id: string, over: Record<string, unknown> = {}) => ({
  id, kind: 'photo', storage_file_id: `f-${id}`, sort_order: 1, created_at: '2026-01-01', ...over,
});

test('listed when on the website, vacant with a rent (or for sale with a price) and with a photo', () => {
  const row = buildPublicListing(unit(), property, { visit_payment_method: 'manual' }, [photo('a')]);
  assert.equal(row?.kind, 'rent');
  assert.equal(row?.title, 'Résidence - A1');
  assert.deepEqual([row?.latitude, row?.longitude], [36.807, 10.181]);
  assert.equal(row?.visit_payment_method, 'manual');
  assert.equal(buildPublicListing(unit({ status: 'for_sale', sale_price: 150000 }), property, undefined, [photo('a')])?.kind, 'sale');
});

test('not listed: hidden, rented, no price, archived, no photo, archived property', () => {
  const photos = [photo('a')];
  assert.equal(buildPublicListing(unit({ show_on_website: false }), property, undefined, photos), null);
  assert.equal(buildPublicListing(unit({ status: 'rented' }), property, undefined, photos), null);
  assert.equal(buildPublicListing(unit({ rent_amount: 0 }), property, undefined, photos), null);
  assert.equal(buildPublicListing(unit({ archived_at: '2026-02-01' }), property, undefined, photos), null);
  assert.equal(buildPublicListing(unit(), property, undefined, [photo('d', { kind: 'document' })]), null);
  assert.equal(buildPublicListing(unit(), { ...property, archived_at: 'x' }, undefined, photos), null);
});

test('cover first, then sort order; positions from 1', () => {
  const row = buildPublicListing(unit(), property, undefined, [photo('a', { sort_order: 1 }), photo('b', { sort_order: 2, is_cover: true }), photo('c', { sort_order: 0 })]);
  assert.equal(row?.cover_file_id, 'f-b');
  assert.deepEqual(row?.photos, [{ storage_file_id: 'f-b', position: 1 }, { storage_file_id: 'f-c', position: 2 }, { storage_file_id: 'f-a', position: 3 }]);
});
