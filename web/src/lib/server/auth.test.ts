// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const session = (role: string) => ({ userId: 'u1', role, token: 't', orgId: 'o1' });

describe('requireWriter', () => {
  it('lets managers and org admins upload and remove files', async () => {
    const { requireWriter } = await import('./auth');
    for (const role of ['org_admin', 'manager']) expect(() => requireWriter(session(role))).not.toThrow();
  });

  it('keeps viewers, clients, retired roles and anonymous callers out', async () => {
    const { requireWriter } = await import('./auth');
    for (const role of ['viewer', 'user', 'public', 'staff', 'staff_pending', '']) expect(() => requireWriter(session(role))).toThrow('forbidden');
  });
});
