import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionExpiredError, freshToken, getSession, setSession, subscribe } from './session';
import type { AuthSession } from './types';

const session = (over: Partial<AuthSession> = {}): AuthSession => ({
  accessToken: 'old-id-token',
  cognitoAccessToken: 'cog',
  refreshToken: 'refresh',
  expiresAt: Date.now() + 60 * 60 * 1000,
  user: { id: 'u1', email: 'a@b.c', displayName: 'A', defaultRole: 'staff' },
  ...over,
});

describe('freshToken', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const refreshReply = (token: string) =>
    new Response(JSON.stringify({ session: session({ accessToken: token, expiresAt: Date.now() + 3_600_000 }) }), { status: 200 });

  it('returns the stored token without a network call while it is still valid', async () => {
    setSession(session());
    await expect(freshToken()).resolves.toBe('old-id-token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when nobody is signed in (public pages keep working)', async () => {
    await expect(freshToken()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes an expired session before returning a token', async () => {
    setSession(session({ expiresAt: Date.now() - 1000 }));
    fetchMock.mockResolvedValue(refreshReply('new-id-token'));
    await expect(freshToken()).resolves.toBe('new-id-token');
    expect(getSession()?.accessToken).toBe('new-id-token');
  });

  it('refreshes once when several calls need a token at the same time', async () => {
    setSession(session({ expiresAt: Date.now() - 1000 }));
    fetchMock.mockResolvedValue(refreshReply('new-id-token'));
    const tokens = await Promise.all([freshToken(), freshToken(), freshToken()]);
    expect(tokens).toEqual(['new-id-token', 'new-id-token', 'new-id-token']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('signs the person out and says the session expired when the refresh is refused', async () => {
    setSession(session({ expiresAt: Date.now() - 1000 }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'NotAuthorizedException' }), { status: 400 }));
    const seen: (AuthSession | null)[] = [];
    const unsubscribe = subscribe((next) => seen.push(next));
    await expect(freshToken()).rejects.toBeInstanceOf(SessionExpiredError);
    unsubscribe();
    expect(getSession()).toBeNull();
    expect(seen.at(-1)).toBeNull();
  });
});
