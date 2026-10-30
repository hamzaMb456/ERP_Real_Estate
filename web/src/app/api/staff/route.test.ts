// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/backend', () => ({ appsyncRequest: vi.fn() }));
vi.mock('@/lib/server/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/auth')>()),
  requireSession: vi.fn(),
}));
vi.mock('@/lib/server/staff-accounts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server/staff-accounts')>()),
  createStaffLogin: vi.fn(),
  deleteStaffLogin: vi.fn(),
  lockStaffLogin: vi.fn(),
  resetStaffAuthenticator: vi.fn(),
}));

import { appsyncRequest } from '@/lib/backend';
import { requireSession } from '@/lib/server/auth';
import { StaffError, createStaffLogin, deleteStaffLogin, lockStaffLogin, resetStaffAuthenticator } from '@/lib/server/staff-accounts';

const session = (role: string) => ({ userId: 'manager-1', role, token: 'tok-1', orgId: '11111111-1111-4111-8111-111111111111' });
const order: string[] = [];

async function post(body: Record<string, unknown>, authorized = true): Promise<Response> {
  const { POST } = await import('./route');
  return POST(new Request('http://localhost/api/staff', {
    method: 'POST',
    headers: authorized ? { authorization: 'Bearer tok-1' } : {},
    body: JSON.stringify(body),
  }));
}

/** Which backend operation was called, from the query text. */
const operationsCalled = (): string[] => vi.mocked(appsyncRequest).mock.calls.map(([query]) => /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? '?');

beforeEach(() => {
  order.length = 0;
  vi.resetAllMocks();
  vi.mocked(requireSession).mockResolvedValue(session('manager'));
  vi.mocked(createStaffLogin).mockImplementation(async () => { order.push('login'); return { userId: 'staff-9' }; });
  vi.mocked(deleteStaffLogin).mockImplementation(async () => { order.push('delete-login'); });
  vi.mocked(lockStaffLogin).mockImplementation(async () => { order.push('lock'); });
  vi.mocked(resetStaffAuthenticator).mockImplementation(async () => { order.push('reset-authenticator'); });
  vi.mocked(appsyncRequest).mockImplementation((async (query: string) => {
    const name = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] ?? '?';
    order.push(name);
    if (name === 'StaffMemberLookup') return { staff_member: { user_id: 'staff-9', email: 'amel@agence.tn', display_name: 'Amel' } };
    return {};
  }) as never);
});

const ALL_ACTIONS: Record<string, unknown>[] = [
  { action: 'create', email: 'a@b.tn', name: 'Amel', branchIds: [] },
  { action: 'resend', userId: 'staff-9' },
  { action: 'disable', userId: 'staff-9' },
  { action: 'resetmfa', userId: 'staff-9' },
];

describe('POST /api/staff access', () => {
  it('answers 401 without a valid session', async () => {
    vi.mocked(requireSession).mockRejectedValue(new Error('unauthorized'));
    expect((await post(ALL_ACTIONS[0], false)).status).toBe(401);
  });

  it('answers 403 to anyone but a manager or org_admin, for every action, and does nothing', async () => {
    for (const role of ['staff', 'viewer', 'user']) {
      vi.mocked(requireSession).mockResolvedValue(session(role));
      for (const body of ALL_ACTIONS) expect((await post(body)).status, `${role} ${String(body.action)}`).toBe(403);
    }
    expect(order).toEqual([]);
  });

  it('answers 400 to an unknown action', async () => {
    expect((await post({ action: 'burn' })).status).toBe(400);
  });
});

describe('POST /api/staff create', () => {
  it('makes the login, then the record, taking the organization from the session and never from the body', async () => {
    const response = await post({ action: 'create', email: 'amel@agence.tn', name: 'Amel', branchIds: ['b-1'], orgId: 'evil-org' });
    expect(response.status).toBe(200);
    expect(order).toEqual(['login', 'CreateStaffRecord']);
    expect(vi.mocked(createStaffLogin).mock.calls[0][0]).toEqual({ email: 'amel@agence.tn', name: 'Amel', orgId: session('manager').orgId });
    expect(vi.mocked(appsyncRequest).mock.calls[0][1]).toEqual({ user_id: 'staff-9', email: 'amel@agence.tn', display_name: 'Amel', branch_ids: ['b-1'] });
    expect(vi.mocked(appsyncRequest).mock.calls[0][2]).toBe('tok-1');
  });

  it('removes the login again when the record cannot be written', async () => {
    vi.mocked(appsyncRequest).mockRejectedValue(new Error('branch_not_found'));
    const response = await post({ action: 'create', email: 'amel@agence.tn', name: 'Amel', branchIds: ['nope'] });
    expect(response.status).toBe(400);
    expect(order).toEqual(['login', 'delete-login']);
    expect(vi.mocked(deleteStaffLogin)).toHaveBeenCalledWith('amel@agence.tn');
  });

  it('answers 409 email_taken and writes no record', async () => {
    vi.mocked(createStaffLogin).mockRejectedValue(new StaffError('email_taken'));
    const response = await post({ action: 'create', email: 'amel@agence.tn', name: 'Amel', branchIds: [] });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'email_taken' });
    expect(operationsCalled()).toEqual([]);
  });

  it('never returns a password', async () => {
    const response = await post({ action: 'create', email: 'amel@agence.tn', name: 'Amel', branchIds: [] });
    expect(JSON.stringify(await response.json())).not.toMatch(/password/i);
  });

  it('answers 400 for a missing email or name', async () => {
    expect((await post({ action: 'create', email: '', name: 'Amel', branchIds: [] })).status).toBe(400);
    expect((await post({ action: 'create', email: 'a@b.tn', name: '', branchIds: [] })).status).toBe(400);
  });
});

describe('POST /api/staff resend, disable, reset', () => {
  it('resend only asks the backend for a new invitation', async () => {
    expect((await post({ action: 'resend', userId: 'staff-9' })).status).toBe(200);
    expect(order).toEqual(['ResendStaffInvitation']);
  });

  it('disable looks the member up in the organization, locks the login, then removes the agencies', async () => {
    expect((await post({ action: 'disable', userId: 'staff-9' })).status).toBe(200);
    expect(order).toEqual(['StaffMemberLookup', 'lock', 'OffboardStaff']);
    expect(vi.mocked(lockStaffLogin)).toHaveBeenCalledWith('amel@agence.tn', { userId: 'staff-9', orgId: session('manager').orgId });
  });

  it('resetmfa looks the member up, clears the second step, then asks for a new invitation', async () => {
    expect((await post({ action: 'resetmfa', userId: 'staff-9' })).status).toBe(200);
    expect(order).toEqual(['StaffMemberLookup', 'reset-authenticator', 'ResetStaffMfa']);
    expect(vi.mocked(resetStaffAuthenticator)).toHaveBeenCalledWith('amel@agence.tn', { userId: 'staff-9', orgId: session('manager').orgId });
  });

  it('never trusts an email sent by the browser for disable', async () => {
    await post({ action: 'disable', userId: 'staff-9', email: 'someone-else@elsewhere.tn' });
    expect(vi.mocked(lockStaffLogin).mock.calls[0][0]).toBe('amel@agence.tn');
  });

  it('stops before the backend when the login is not a staff login of the caller organization', async () => {
    vi.mocked(lockStaffLogin).mockRejectedValue(new StaffError('staff_not_found'));
    const response = await post({ action: 'disable', userId: 'staff-9' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'staff_not_found' });
    expect(operationsCalled()).toEqual(['StaffMemberLookup']);
  });

  it('resetmfa also stops when the login is not a staff login of the caller organization', async () => {
    vi.mocked(resetStaffAuthenticator).mockRejectedValue(new StaffError('staff_not_found'));
    const response = await post({ action: 'resetmfa', userId: 'staff-9' });
    expect(response.status).toBe(400);
    expect(operationsCalled()).toEqual(['StaffMemberLookup']);
  });
});
