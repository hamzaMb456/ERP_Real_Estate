// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const session = (role: string) => ({ userId: 'u1', role, token: 't', orgId: 'o1' });

describe('requireFileEditor', () => {
  it('lets managers, org admins and regional staff upload and remove files', async () => {
    const { requireFileEditor } = await import('./auth');
    for (const role of ['org_admin', 'manager', 'staff']) expect(() => requireFileEditor(session(role))).not.toThrow();
  });

  it('keeps viewers, clients and anonymous callers out', async () => {
    const { requireFileEditor } = await import('./auth');
    for (const role of ['viewer', 'user', 'public', 'staff_pending', '']) expect(() => requireFileEditor(session(role))).toThrow('forbidden');
  });
});

describe('requireWriter', () => {
  it('stays limited to managers and org admins', async () => {
    const { requireWriter } = await import('./auth');
    expect(() => requireWriter(session('manager'))).not.toThrow();
    expect(() => requireWriter(session('staff'))).toThrow('forbidden');
  });
});
