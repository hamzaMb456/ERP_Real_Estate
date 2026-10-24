import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from './index.ts';

const context = (role: string) => ({ identity: { resolverContext: { role, userId: 'u1', orgId: 'o1' } } });

// The Lambda runtime turns a thrown Error into { errorType, errorMessage, trace: stack.split('\n') } and AppSync
// forwards that to the caller. Only the code may survive: no file paths, no frames.
async function thrownBy(event: Parameters<typeof handler>[0]): Promise<Error> {
  try {
    await handler(event);
  } catch (err) {
    return err as Error;
  }
  throw new Error('handler did not throw');
}

const FRAME = /\n\s*at |\/var\/task|node_modules|\.ts:\d+|\.js:\d+/;

test('a business-rule error keeps its code and carries no stack frames', async () => {
  const err = await thrownBy({ fieldName: 'run', arguments: { op: 'Contacts', variables: '{}' }, ...context('public') });
  assert.equal(err.message, 'permission_denied');
  assert.equal(err.name, 'DomainError');
  assert.doesNotMatch(err.stack ?? '', FRAME);
  assert.equal((err.stack ?? '').split('\n').length, 1);
});

test('an unexpected error becomes internal_error: no internals reach the caller, the original is logged', async () => {
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    // Valid role, broken JSON: fails inside the handler with a SyntaxError that is not a DomainError.
    const err = await thrownBy({ fieldName: 'run', arguments: { op: 'Contacts', variables: '{' }, ...context('org_admin') });
    assert.equal(err.message, 'internal_error');
    assert.doesNotMatch(err.message, /JSON|Unexpected/);
    assert.doesNotMatch(err.stack ?? '', FRAME);
    assert.equal(logged.length, 1);
    assert.ok(logged[0].some((arg) => arg instanceof SyntaxError), 'the original error is logged server side');
  } finally {
    console.error = original;
  }
});

test('whoami and the other successful paths are unchanged', async () => {
  assert.equal(await handler({ fieldName: 'whoami', ...context('manager') }), 'manager:o1');
});
