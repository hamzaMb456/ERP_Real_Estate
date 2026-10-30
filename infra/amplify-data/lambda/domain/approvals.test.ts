import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NEEDS_APPROVAL, missingFromCode } from './approvals.ts';

test('the missing items come back from the activation error code', () => {
  assert.deepEqual(missingFromCode(`${NEEDS_APPROVAL}:deposit_amount,doc:signed_lease`), ['deposit_amount', 'doc:signed_lease']);
  assert.deepEqual(missingFromCode(`${NEEDS_APPROVAL}:doc:id_document`), ['doc:id_document']);
});

test('other error codes are not approval requests', () => {
  assert.equal(missingFromCode('lease_needs_renter'), null);
  assert.equal(missingFromCode('out_of_scope'), null);
});
