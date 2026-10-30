// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const fetchMock = vi.fn();

const ok = (body: Record<string, unknown> = {}) => new Response(JSON.stringify(body), { status: 200 });
const failure = (type: string) => new Response(JSON.stringify({ __type: type, message: 'x' }), { status: 400 });
const created = (sub = 'sub-1') => ok({ User: { Attributes: [{ Name: 'sub', Value: sub }, { Name: 'email', Value: 'a@b.tn' }] } });

function calls(): { target: string; body: Record<string, unknown> }[] {
  return fetchMock.mock.calls.map(([, init]) => {
    const request = init as RequestInit;
    return {
      target: (request.headers as Record<string, string>)['X-Amz-Target'].replace('AWSCognitoIdentityProviderService.', ''),
      body: JSON.parse(request.body as string) as Record<string, unknown>,
    };
  });
}

beforeEach(() => {
  vi.stubEnv('AUTH_COGNITO_URL', 'http://cognito.test/');
  vi.stubEnv('AUTH_CLIENT_ID', 'client-1');
  vi.stubEnv('AUTH_USER_POOL_ID', 'pool-1');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('createStaffLogin', () => {
  it('creates a silent login as staff_pending in the given organization and returns only the user id', async () => {
    fetchMock.mockResolvedValueOnce(created('sub-9')).mockResolvedValueOnce(ok());
    const { createStaffLogin } = await import('./staff-accounts');
    const result = await createStaffLogin({ email: 'a@b.tn', name: 'Amel', orgId: 'org-1' });
    expect(result).toEqual({ userId: 'sub-9' });
    const [create, update] = calls();
    expect(create.target).toBe('AdminCreateUser');
    expect(create.body).toMatchObject({ UserPoolId: 'pool-1', Username: 'a@b.tn', MessageAction: 'SUPPRESS' });
    expect(String(create.body.TemporaryPassword).length).toBeGreaterThanOrEqual(20);
    expect(update.target).toBe('AdminUpdateUserAttributes');
    expect(update.body.UserAttributes).toEqual([{ Name: 'custom:role', Value: 'staff_pending' }, { Name: 'custom:org_id', Value: 'org-1' }]);
    expect(JSON.stringify(result)).not.toContain(String(create.body.TemporaryPassword));
  });

  it('answers email_taken for an email that already has a login (real Cognito and the emulator word it differently)', async () => {
    const { createStaffLogin, StaffError } = await import('./staff-accounts');
    for (const type of ['UsernameExistsException', 'AliasExistsException']) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(failure(type));
      await expect(createStaffLogin({ email: 'a@b.tn', name: 'Amel', orgId: 'org-1' })).rejects.toMatchObject({ code: 'email_taken' });
    }
    expect(new StaffError('email_taken')).toBeInstanceOf(Error);
  });

  it('removes the login again when the role cannot be set', async () => {
    fetchMock.mockResolvedValueOnce(created()).mockResolvedValueOnce(failure('InternalErrorException')).mockResolvedValueOnce(ok());
    const { createStaffLogin } = await import('./staff-accounts');
    await expect(createStaffLogin({ email: 'a@b.tn', name: 'Amel', orgId: 'org-1' })).rejects.toThrow();
    expect(calls().map((c) => c.target)).toEqual(['AdminCreateUser', 'AdminUpdateUserAttributes', 'AdminDeleteUser']);
  });
});

const WHO = { userId: 'user-1', orgId: 'org-1' };
const login = (over: { sub?: string; org?: string; role?: string } = {}) =>
  ok({
    UserAttributes: [
      { Name: 'sub', Value: over.sub ?? 'user-1' },
      { Name: 'custom:org_id', Value: over.org ?? 'org-1' },
      { Name: 'custom:role', Value: over.role ?? 'staff' },
    ],
  });

describe('assertStaffLogin', () => {
  it('accepts a staff login of the expected organization and id', async () => {
    fetchMock.mockResolvedValueOnce(login());
    const { assertStaffLogin } = await import('./staff-accounts');
    await expect(assertStaffLogin('a@b.tn', { ...WHO, roles: ['staff', 'staff_pending'] })).resolves.toBeUndefined();
  });

  it('refuses a login of another organization, another id, or a role that is not staff', async () => {
    const { assertStaffLogin } = await import('./staff-accounts');
    for (const over of [{ org: 'org-2' }, { sub: 'someone-else' }, { role: 'org_admin' }, { role: 'client' }, { role: 'manager' }]) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(login(over));
      await expect(assertStaffLogin('a@b.tn', { ...WHO, roles: ['staff', 'staff_pending'] }), JSON.stringify(over)).rejects.toMatchObject({ code: 'staff_not_found' });
    }
  });

  it('refuses an unknown login with the same error', async () => {
    fetchMock.mockResolvedValueOnce(failure('UserNotFoundException'));
    const { assertStaffLogin } = await import('./staff-accounts');
    await expect(assertStaffLogin('a@b.tn', { ...WHO, roles: ['staff'] })).rejects.toMatchObject({ code: 'staff_not_found' });
  });
});

describe('lockStaffLogin', () => {
  it('checks the login, then disables, signs out everywhere, and sets the role back to staff_pending, in that order', async () => {
    fetchMock.mockResolvedValueOnce(login()).mockResolvedValue(ok());
    const { lockStaffLogin } = await import('./staff-accounts');
    await lockStaffLogin('a@b.tn', WHO);
    expect(calls().map((c) => c.target)).toEqual(['AdminGetUser', 'AdminDisableUser', 'AdminUserGlobalSignOut', 'AdminUpdateUserAttributes']);
    expect(calls()[3].body.UserAttributes).toEqual([{ Name: 'custom:role', Value: 'staff_pending' }]);
  });

  it('does nothing to a login of another organization (a forged record cannot lock someone else)', async () => {
    fetchMock.mockResolvedValueOnce(login({ org: 'org-2', role: 'org_admin' }));
    const { lockStaffLogin } = await import('./staff-accounts');
    await expect(lockStaffLogin('victim@orgb.tn', WHO)).rejects.toMatchObject({ code: 'staff_not_found' });
    expect(calls().map((c) => c.target)).toEqual(['AdminGetUser']);
  });
});

describe('resetStaffAuthenticator', () => {
  it('checks the login, turns the second step off and sets the role back to staff_pending', async () => {
    fetchMock.mockResolvedValueOnce(login()).mockResolvedValue(ok());
    const { resetStaffAuthenticator } = await import('./staff-accounts');
    await resetStaffAuthenticator('a@b.tn', WHO);
    expect(calls().map((c) => c.target)).toEqual(['AdminGetUser', 'AdminSetUserMFAPreference', 'AdminUserGlobalSignOut', 'AdminUpdateUserAttributes']);
    expect(calls()[1].body.SoftwareTokenMfaSettings).toEqual({ Enabled: false, PreferredMfa: false });
    expect(calls()[3].body.UserAttributes).toEqual([{ Name: 'custom:role', Value: 'staff_pending' }]);
  });

  it('does nothing to a login of another organization', async () => {
    fetchMock.mockResolvedValueOnce(login({ org: 'org-2', role: 'client' }));
    const { resetStaffAuthenticator } = await import('./staff-accounts');
    await expect(resetStaffAuthenticator('victim@orgb.tn', WHO)).rejects.toMatchObject({ code: 'staff_not_found' });
    expect(calls().map((c) => c.target)).toEqual(['AdminGetUser']);
  });
});
