import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distinctOn, eqValue, matches, page, sortRows } from './query-eval.ts';

const rows = [
  { id: 'a', city: 'Tunis', price: 900, rooms: 2, available_from: null, property: { name: 'Zeta' } },
  { id: 'b', city: 'Sfax', price: 1500, rooms: 4, available_from: '2026-05-01', property: { name: 'Alpha' } },
  { id: 'c', city: null, price: 700, rooms: null, available_from: '2026-08-01', property: { name: 'Mid' } },
];
const ids = (list: { id: string }[]) => list.map((r) => r.id);

test('operators with SQL null semantics, _and/_or/_not, relationships', () => {
  assert.deepEqual(ids(rows.filter((r) => matches(r, { price: { _gte: 800, _lte: 1500 } }))), ['a', 'b']);
  assert.deepEqual(ids(rows.filter((r) => matches(r, { rooms: { _gte: 2 } }))), ['a', 'b']);
  assert.deepEqual(ids(rows.filter((r) => matches(r, { city: { _nin: ['Sfax'] } }))), ['a']);
  assert.deepEqual(ids(rows.filter((r) => matches(r, { city: { _is_null: true } }))), ['c']);
  assert.deepEqual(ids(rows.filter((r) => matches(r, { _or: [{ available_from: { _is_null: true } }, { available_from: { _lte: '2026-06-01' } }] }))), ['a', 'b']);
  assert.deepEqual(ids(rows.filter((r) => matches(r, { _not: { city: { _eq: 'Tunis' } } }))), ['b', 'c']);
  assert.deepEqual(ids(rows.filter((r) => matches(r, { city: { _ilike: '%fA%' } }))), ['b']);
  assert.deepEqual(ids(rows.filter((r) => matches(r, { property: { name: { _eq: 'Alpha' } } }))), ['b']);
  assert.throws(() => matches(rows[0], { price: { _similar: 'x' } as never }));
});

test('order: Postgres null placement, nested paths, multiple keys', () => {
  assert.deepEqual(ids(sortRows(rows, { rooms: 'asc' })), ['a', 'b', 'c']);
  assert.deepEqual(ids(sortRows(rows, { rooms: 'desc' })), ['c', 'b', 'a']);
  assert.deepEqual(ids(sortRows(rows, { available_from: 'desc_nulls_last' })), ['c', 'b', 'a']);
  assert.deepEqual(ids(sortRows(rows, [{ property: { name: 'asc' } }])), ['b', 'c', 'a']);
});

test('page, distinct_on and _eq extraction', () => {
  assert.deepEqual(ids(page(rows, 1, 1)), ['b']);
  assert.deepEqual(distinctOn([{ city: 'X' }, { city: 'X' }, { city: 'Y' }], 'city'), [{ city: 'X' }, { city: 'Y' }]);
  assert.equal(eqValue({ _and: [{ price: { _gte: 1 } }, { organization_id: { _eq: 'org' } }] }, 'organization_id'), 'org');
  assert.equal(eqValue({ price: { _gte: 1 } }, 'organization_id'), undefined);
});
