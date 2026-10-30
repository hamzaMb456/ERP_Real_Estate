import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanBranch } from './branches.ts';

const code = (fn: () => unknown): string => {
  try { fn(); } catch (err) { return (err as { code: string }).code; }
  return 'no error';
};

test('a branch needs a name; blank optional fields become null', () => {
  assert.equal(code(() => cleanBranch({ name: '   ' })), 'branch_name_required');
  assert.deepEqual(cleanBranch({ name: ' Aouina ', city: ' ', phone: '28 600 115' }), {
    name: 'Aouina', slug: null, city: null, region: null, address: null, phone: '28 600 115',
  });
});

test('the slug is lowercase words joined by single dashes', () => {
  assert.equal(cleanBranch({ name: 'Aouina', slug: 'Grand-Tunis-Aouina' }).slug, 'grand-tunis-aouina');
  assert.equal(code(() => cleanBranch({ name: 'Aouina', slug: 'aouina--ouest' })), 'branch_slug_invalid');
  assert.equal(code(() => cleanBranch({ name: 'Aouina', slug: 'aouina sud' })), 'branch_slug_invalid');
});
