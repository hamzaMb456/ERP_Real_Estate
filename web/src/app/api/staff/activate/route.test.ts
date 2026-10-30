// @vitest-environment node
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/site/public-api', () => ({ publicQuery: vi.fn() }));

import { publicQuery } from '@/lib/site/public-api';

const fetchMock = vi.fn();
const TOKEN = 'inv-1.signature';

const ok = (body: Record<string, unknown> = {}) => new Response(JSON.stringify(body), { status: 200 });
const failure = (type: string) => new Response(JSON.stringify({ __type: type, message: 'x' }), { status: 400 });
const valid = { staff_invitation: { ok: true, user_id: 'user-1', organization_id: 'org-1', email: 'amel@agence.tn', display_name: 'Amel' } };
/** What Cognito says the login is: by default the pending staff login the invitation was made for. */
const pendingLogin = (over: { sub?: string; org?: string; role?: string } = {}) =>
  ok({
    UserAttributes: [
      { Name: 'sub', Value: over.sub ?? 'user-1' },
      { Name: 'custom:org_id', Value: over.org ?? 'org-1' },
      { Name: 'custom:role', Value: over.role ?? 'staff_pending' },
    ],
  });
const invalid = { staff_invitation: { ok: false } };

const cognitoCalls = (): { target: string; body: Record<string, unknown> }[] =>
  fetchMock.mock.calls.map(([, init]) => {
    const request = init as RequestInit;
    return {
      target: (request.headers as Record<string, string>)['X-Amz-Target'].replace('AWSCognitoIdentityProviderService.', ''),
      body: JSON.parse(request.body as string) as Record<string, unknown>,
    };
  });
const publicOperations = (): string[] => vi.mocked(publicQuery).mock.calls.map(([query]) => /(?:query|mutation)\s+(\w+)/.exec(query as string)?.[1] ?? '?');

async function post(body: Record<string, unknown>): Promise<Response> {
  const { POST } = await import('./route');
  return POST(new Request('http://localhost/api/staff/activate', { method: 'POST', body: JSON.stringify(body) }));
}

beforeEach(() => {
  vi.stubEnv('AUTH_COGNITO_URL', 'http://cognito.test/');
  vi.stubEnv('AUTH_CLIENT_ID', 'client-1');
  vi.stubEnv('AUTH_USER_POOL_ID', 'pool-1');
  vi.stubEnv('STAFF_INVITE_SECRET', 'web-invite-secret');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  vi.mocked(publicQuery).mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('check', () => {
  it('names the person for a valid link', async () => {
    vi.mocked(publicQuery).mockResolvedValue(valid);
    const response = await post({ action: 'check', token: TOKEN });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ email: 'amel@agence.tn', name: 'Amel' });
  });

  it('answers the same error for an unknown, expired, used or revoked link', async () => {
    vi.mocked(publicQuery).mockResolvedValue(invalid);
    const response = await post({ action: 'check', token: TOKEN });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid-invitation' });
  });
});

describe('setpassword', () => {
  it('does nothing in Cognito for an invalid link', async () => {
    vi.mocked(publicQuery).mockResolvedValue(invalid);
    const response = await post({ action: 'setpassword', token: TOKEN, password: 'a-Strong-pass-1' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid-invitation' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sets the password, signs in once and starts the authenticator enrolment', async () => {
    vi.mocked(publicQuery).mockResolvedValue(valid);
    fetchMock
      .mockResolvedValueOnce(pendingLogin())
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok({ AuthenticationResult: { AccessToken: 'access-1', IdToken: 'id-1', RefreshToken: 'r', ExpiresIn: 3600 } }))
      .mockResolvedValueOnce(ok({ SecretCode: 'JBSWY3DPEHPK3PXP' }));
    const response = await post({ action: 'setpassword', token: TOKEN, password: 'a-Strong-pass-1' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { setupKey: string; otpauthUrl: string; accessToken: string };
    expect(cognitoCalls().map((c) => c.target)).toEqual(['AdminGetUser', 'AdminSetUserPassword', 'InitiateAuth', 'AssociateSoftwareToken']);
    expect(cognitoCalls()[1].body).toMatchObject({ Username: 'amel@agence.tn', Password: 'a-Strong-pass-1', Permanent: true });
    expect(body.setupKey).toBe('JBSWY3DPEHPK3PXP');
    expect(body.otpauthUrl).toContain('otpauth://totp/');
    expect(body.otpauthUrl).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(body.otpauthUrl).toContain(encodeURIComponent('amel@agence.tn'));
    expect(body.accessToken).toBe('access-1');
    expect(JSON.stringify(body)).not.toContain('a-Strong-pass-1');
  });

  it('answers invalid-password when Cognito refuses the password', async () => {
    vi.mocked(publicQuery).mockResolvedValue(valid);
    fetchMock.mockResolvedValueOnce(pendingLogin()).mockResolvedValueOnce(failure('InvalidPasswordException'));
    const response = await post({ action: 'setpassword', token: TOKEN, password: 'short' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid-password' });
  });
});

describe('a link cannot be used on a login that is not its own', () => {
  it('setpassword refuses a login of another organization or another role, and sets nothing', async () => {
    for (const over of [{ org: 'org-2' }, { role: 'org_admin' }, { role: 'client' }, { role: 'staff' }, { sub: 'someone-else' }]) {
      fetchMock.mockReset();
      vi.mocked(publicQuery).mockResolvedValue(valid);
      fetchMock.mockResolvedValueOnce(pendingLogin(over));
      const response = await post({ action: 'setpassword', token: TOKEN, password: 'a-Strong-pass-1' });
      expect(response.status, JSON.stringify(over)).toBe(400);
      expect(await response.json()).toEqual({ error: 'invalid-invitation' });
      expect(cognitoCalls().map((c) => c.target)).toEqual(['AdminGetUser']);
    }
  });

  it('verify refuses a login of another organization or another role, and promotes nothing', async () => {
    for (const over of [{ org: 'org-2' }, { role: 'org_admin' }, { role: 'client' }]) {
      fetchMock.mockReset();
      vi.mocked(publicQuery).mockResolvedValue(valid);
      fetchMock.mockResolvedValueOnce(pendingLogin(over));
      const response = await post({ action: 'verify', token: TOKEN, code: '123456', accessToken: 'access-1' });
      expect(response.status, JSON.stringify(over)).toBe(400);
      expect(cognitoCalls().map((c) => c.target)).toEqual(['AdminGetUser']);
    }
  });
});

describe('verify', () => {
  it('does nothing in Cognito for an invalid link', async () => {
    vi.mocked(publicQuery).mockResolvedValue(invalid);
    expect((await post({ action: 'verify', token: TOKEN, code: '123456', accessToken: 'access-1' })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses an access token that belongs to another user', async () => {
    vi.mocked(publicQuery).mockResolvedValue(valid);
    fetchMock.mockResolvedValueOnce(pendingLogin()).mockResolvedValueOnce(ok({ Username: 'someone', UserAttributes: [{ Name: 'sub', Value: 'user-2' }] }));
    const response = await post({ action: 'verify', token: TOKEN, code: '123456', accessToken: 'access-of-user-2' });
    expect(response.status).toBe(400);
    expect(cognitoCalls().map((c) => c.target)).toEqual(['AdminGetUser', 'GetUser']);
    expect(publicOperations()).toEqual(['StaffInvitationCheck']);
  });

  it('a wrong code leaves the role unchanged and the invitation unused', async () => {
    vi.mocked(publicQuery).mockResolvedValue(valid);
    fetchMock
      .mockResolvedValueOnce(pendingLogin())
      .mockResolvedValueOnce(ok({ UserAttributes: [{ Name: 'sub', Value: 'user-1' }] }))
      .mockResolvedValueOnce(failure('EnableSoftwareTokenMFAException'));
    const response = await post({ action: 'verify', token: TOKEN, code: '000000', accessToken: 'access-1' });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid-code' });
    expect(cognitoCalls().map((c) => c.target)).not.toContain('AdminUpdateUserAttributes');
    expect(publicOperations()).toEqual(['StaffInvitationCheck']);
  });

  it('a right code makes the second step the preference, switches the role to staff, then confirms the link', async () => {
    vi.mocked(publicQuery).mockResolvedValueOnce(valid).mockResolvedValueOnce({ confirm_staff_activation: { ok: true } });
    fetchMock
      .mockResolvedValueOnce(pendingLogin())
      .mockResolvedValueOnce(ok({ UserAttributes: [{ Name: 'sub', Value: 'user-1' }] }))
      .mockResolvedValueOnce(ok({ Status: 'SUCCESS' }))
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce(ok());
    const response = await post({ action: 'verify', token: TOKEN, code: '123456', accessToken: 'access-1' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(cognitoCalls().map((c) => c.target)).toEqual(['AdminGetUser', 'GetUser', 'VerifySoftwareToken', 'SetUserMFAPreference', 'AdminUpdateUserAttributes']);
    expect(cognitoCalls()[3].body.SoftwareTokenMfaSettings).toEqual({ Enabled: true, PreferredMfa: true });
    expect(cognitoCalls()[4].body.UserAttributes).toEqual([{ Name: 'custom:role', Value: 'staff' }]);
    expect(publicOperations()).toEqual(['StaffInvitationCheck', 'ConfirmStaffActivation']);
    const expectedProof = createHmac('sha256', 'web-invite-secret').update('confirm.inv-1').digest('hex');
    expect(vi.mocked(publicQuery).mock.calls[1][1]).toEqual({ token: TOKEN, proof: expectedProof });
  });

  it('without the server secret nothing is changed in Cognito', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('AUTH_COGNITO_URL', 'http://cognito.test/');
    vi.stubEnv('AUTH_CLIENT_ID', 'client-1');
    vi.stubEnv('AUTH_USER_POOL_ID', 'pool-1');
    vi.mocked(publicQuery).mockResolvedValue(valid);
    fetchMock.mockResolvedValue(pendingLogin());
    const response = await post({ action: 'verify', token: TOKEN, code: '123456', accessToken: 'access-1' });
    expect(response.status).toBe(500);
    expect(cognitoCalls().map((c) => c.target)).not.toContain('AdminUpdateUserAttributes');
    expect(publicOperations()).not.toContain('ConfirmStaffActivation');
  });
});

it('answers 400 to an unknown action', async () => {
  expect((await post({ action: 'burn' })).status).toBe(400);
});
