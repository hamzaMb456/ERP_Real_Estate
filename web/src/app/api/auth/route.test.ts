// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const fetchMock = vi.fn();

function cognitoOk(body: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

function cognitoError(type: string): Response {
  return new Response(JSON.stringify({ __type: type, message: 'x' }), { status: 400 });
}

async function post(body: Record<string, unknown>): Promise<Response> {
  const { POST } = await import('./route');
  return POST(new Request('http://localhost/api/auth', { method: 'POST', body: JSON.stringify(body) }));
}

function lastCall(): { target: string; body: Record<string, unknown> } {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  const headers = init.headers as Record<string, string>;
  return { target: headers['X-Amz-Target'], body: JSON.parse(init.body as string) as Record<string, unknown> };
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

describe('POST /api/auth forgot', () => {
  it('asks Cognito to send a reset code', async () => {
    fetchMock.mockResolvedValue(cognitoOk({ CodeDeliveryDetails: {} }));

    const response = await post({ action: 'forgot', email: 'a@b.tn' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
    expect(lastCall()).toEqual({
      target: 'AWSCognitoIdentityProviderService.ForgotPassword',
      body: { ClientId: 'client-1', Username: 'a@b.tn' },
    });
  });

  it('answers the same when the account does not exist, so addresses cannot be probed', async () => {
    fetchMock.mockResolvedValue(cognitoError('UserNotFoundException'));

    const response = await post({ action: 'forgot', email: 'ghost@b.tn' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: true });
  });

  it('passes a rate-limit error through', async () => {
    fetchMock.mockResolvedValue(cognitoError('LimitExceededException'));

    const response = await post({ action: 'forgot', email: 'a@b.tn' });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'LimitExceededException' });
  });

  it('rejects a request without an email', async () => {
    const response = await post({ action: 'forgot' });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid-request' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/auth resetpassword', () => {
  it('confirms the code and sets the new password', async () => {
    fetchMock.mockResolvedValue(cognitoOk());

    const response = await post({ action: 'resetpassword', email: 'a@b.tn', code: '123456', newPassword: 'Abcdef12' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(lastCall()).toEqual({
      target: 'AWSCognitoIdentityProviderService.ConfirmForgotPassword',
      body: { ClientId: 'client-1', Username: 'a@b.tn', ConfirmationCode: '123456', Password: 'Abcdef12' },
    });
  });

  it('reports a wrong code', async () => {
    fetchMock.mockResolvedValue(cognitoError('CodeMismatchException'));

    const response = await post({ action: 'resetpassword', email: 'a@b.tn', code: '000000', newPassword: 'Abcdef12' });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'CodeMismatchException' });
  });

  it('rejects a request missing the code or the password', async () => {
    for (const body of [{ email: 'a@b.tn', newPassword: 'Abcdef12' }, { email: 'a@b.tn', code: '123456' }]) {
      const response = await post({ action: 'resetpassword', ...body });
      expect(response.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
