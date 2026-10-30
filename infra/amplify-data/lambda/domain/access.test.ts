import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactVisible, unitVisible } from './access.ts';

test('a null set (manager, org_admin, viewer) sees every unit and contact', () => {
  assert.equal(unitVisible(null, 'U-ANY'), true);
  assert.equal(unitVisible(null, undefined), true);
  assert.equal(contactVisible(null, { id: 'C1' }), true);
});

test('a regional set holds only its units and contacts', () => {
  const units = new Set(['U1']);
  assert.equal(unitVisible(units, 'U1'), true);
  assert.equal(unitVisible(units, 'U2'), false);
  assert.equal(unitVisible(units, undefined), false);
  const contacts = new Set(['C1']);
  assert.equal(contactVisible(contacts, { id: 'C1' }), true);
  assert.equal(contactVisible(contacts, { id: 'C2' }), false);
});
