import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthError, SessionExpiredError, freshToken, getSession, setSession, subscribe, trackActivity } from './session';
import type { AuthSession } from './types';

const session = (over: Partial<AuthSession> = {}): AuthSession => ({
  accessToken: 'old-id-token',
  cognitoAccessToken: 'cog',
  refreshToken: 'refresh',
  expiresAt: Date.now() + 60 * 60 * 1000,
  user: { id: 'u1', email: 'a@b.c', displayName: 'A', defaultRole: 'manager' },
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

  it('keeps the session when the network drops during the refresh, and retries on the next request', async () => {
    setSession(session({ expiresAt: Date.now() - 1000 }));
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(freshToken()).rejects.toBeInstanceOf(AuthError);
    expect(getSession()?.refreshToken).toBe('refresh');

    fetchMock.mockResolvedValueOnce(refreshReply('new-id-token'));
    await expect(freshToken()).resolves.toBe('new-id-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the session when Cognito answers with a server error', async () => {
    setSession(session({ expiresAt: Date.now() - 1000 }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'server-error' }), { status: 500 }));
    await expect(freshToken()).rejects.toBeInstanceOf(AuthError);
    expect(getSession()).not.toBeNull();
  });
});

describe('idle timeout', () => {
  const fetchMock = vi.fn();
  const T0 = new Date('2026-10-30T10:00:00Z').getTime();
  const MINUTE = 60_000;
  let stopTracking: (() => void) | null = null;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    stopTracking?.();
    stopTracking = null;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const input = () => window.dispatchEvent(new Event('pointerdown'));

  it('ends the session after 30 minutes without activity', async () => {
    setSession(session());
    vi.setSystemTime(T0 + 31 * MINUTE);
    await expect(freshToken()).rejects.toBeInstanceOf(SessionExpiredError);
    expect(getSession()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the session while the person keeps using the app', async () => {
    setSession(session());
    stopTracking = trackActivity();
    vi.setSystemTime(T0 + 20 * MINUTE);
    input();
    vi.setSystemTime(T0 + 40 * MINUTE);
    await expect(freshToken()).resolves.toBe('old-id-token');
  });

  it('a click after a long pause ends the session instead of extending it', () => {
    setSession(session());
    stopTracking = trackActivity();
    vi.setSystemTime(T0 + 31 * MINUTE);
    input();
    expect(getSession()).toBeNull();
  });

  it('a token refresh does not restart the idle clock', async () => {
    setSession(session({ expiresAt: T0 + 3 * MINUTE }));
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ session: session({ accessToken: 'new-id-token', expiresAt: T0 + 80 * MINUTE }) }), { status: 200 }),
    );
    vi.setSystemTime(T0 + 20 * MINUTE);
    await expect(freshToken()).resolves.toBe('new-id-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(T0 + 31 * MINUTE);
    await expect(freshToken()).rejects.toBeInstanceOf(SessionExpiredError);
  });
});
