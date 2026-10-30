import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertInScope, inScope, priceChanges, scopedRows } from './scope.ts';

const aouina = new Set(['B-AOUINA']);

test('whole organization (null scope) is in scope for any branch', () => {
  assert.equal(inScope(null, 'B-AOUINA'), true);
  assert.equal(inScope(null, undefined), true);
});

test('a regional scope holds only its own branches', () => {
  assert.equal(inScope(aouina, 'B-AOUINA'), true);
  assert.equal(inScope(aouina, 'B-BIZERTE'), false);
  assert.equal(inScope(aouina, undefined), false);
  assert.equal(inScope(aouina, null), false);
});

test('an empty scope (staff with no branch) sees nothing', () => {
  assert.equal(inScope(new Set(), 'B-AOUINA'), false);
});

test('scopedRows keeps only rows in the scope and keeps all with null scope', () => {
  const rows = [{ id: 'P1', branch_id: 'B-AOUINA' }, { id: 'P2', branch_id: 'B-BIZERTE' }];
  const branchOf = (r: { branch_id: string }) => r.branch_id;
  assert.deepEqual(scopedRows(aouina, rows, branchOf).map((r) => r.id), ['P1']);
  assert.deepEqual(scopedRows(null, rows, branchOf).map((r) => r.id), ['P1', 'P2']);
});

test('assertInScope refuses a branch outside the scope with out_of_scope', () => {
  assert.doesNotThrow(() => assertInScope(aouina, 'B-AOUINA'));
  assert.throws(() => assertInScope(aouina, 'B-BIZERTE'), (err: { code?: string }) => err.code === 'out_of_scope');
});

test('priceChanges lists only price fields that really change', () => {
  const current = { rent_amount: 900, sale_price: null, deposit_months: 2, name: 'A' };
  assert.deepEqual(priceChanges(current, { rent_amount: '900', name: 'B' }), []);
  assert.deepEqual(priceChanges(current, { rent_amount: '1000' }), ['rent_amount']);
  assert.deepEqual(priceChanges(current, { sale_price: '250000', deposit_months: 2 }), ['sale_price']);
  assert.deepEqual(priceChanges(current, { reservation_deposit: 10000 }), ['reservation_deposit']);
});
