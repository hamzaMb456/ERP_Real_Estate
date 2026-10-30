import type { AuthSession } from '@/lib/auth/types';

const STORAGE_KEY = 'erp-auth-session';
const REFRESH_BEFORE_MS = 5 * 60 * 1000;

export class AuthError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type Listener = (session: AuthSession | null) => void;
const listeners = new Set<Listener>();

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as AuthSession) : null;
}

export function setSession(session: AuthSession | null): void {
  if (typeof window !== 'undefined') {
    if (session) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(STORAGE_KEY);
  }
  for (const listener of listeners) listener(session);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new AuthError('unreachable');
  }
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new AuthError(data.error ?? 'server-error');
  return data;
}

export type SignInResult =
  | { kind: 'signed-in' }
  | { kind: 'new-password'; email: string; challengeSession: string }
  | { kind: 'mfa'; email: string; challengeSession: string; challengeUserId: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const data = await call<{ session?: AuthSession; challenge?: string; email?: string; challengeSession?: string; challengeUserId?: string }>(
    'signin',
    { email, password },
  );
  if (data.challenge === 'mfa' && data.email && data.challengeSession && data.challengeUserId) {
    return { kind: 'mfa', email: data.email, challengeSession: data.challengeSession, challengeUserId: data.challengeUserId };
  }
  if (data.challenge === 'new-password' && data.email && data.challengeSession) {
    return { kind: 'new-password', email: data.email, challengeSession: data.challengeSession };
  }
  if (!data.session) throw new AuthError('server-error');
  setSession(data.session);
  return { kind: 'signed-in' };
}

export async function completeNewPassword(email: string, newPassword: string, challengeSession: string): Promise<void> {
  const data = await call<{ session: AuthSession }>('newpassword', { email, newPassword, challengeSession });
  setSession(data.session);
}

/** Second step for regional staff: the 6-digit code from their authenticator app. */
export async function completeMfa(email: string, code: string, challengeSession: string, challengeUserId: string): Promise<void> {
  const data = await call<{ session: AuthSession }>('mfa', { email, code, challengeSession, challengeUserId });
  setSession(data.session);
}

export async function signUp(name: string, email: string, password: string): Promise<void> {
  await call('signup', { name, email, password });
}

export async function confirmSignUp(email: string, code: string): Promise<void> {
  await call('confirm', { email, code });
}

/** Asks for a reset code by e-mail. Answers the same whether or not the account exists. */
export async function requestPasswordReset(email: string): Promise<void> {
  await call('forgot', { email });
}

/** Sets a new password with the code that was e-mailed. The caller signs in afterwards. */
export async function confirmPasswordReset(email: string, code: string, newPassword: string): Promise<void> {
  await call('resetpassword', { email, code, newPassword });
}

/** The refresh that is already running, so calls that start together share one request. */
let refreshing: Promise<AuthSession | null> | null = null;

/** Cognito's answer when the refresh token itself is no longer valid. Only this ends the session. */
const REFRESH_REFUSED = 'NotAuthorizedException';

async function refreshSession(session: AuthSession): Promise<AuthSession | null> {
  if (!session.refreshToken) {
    setSession(null);
    return null;
  }
  try {
    const data = await call<{ session: AuthSession }>('refresh', { refreshToken: session.refreshToken });
    setSession(data.session);
    return data.session;
  } catch (error) {
    // A dropped connection or a Cognito hiccup is not a sign-out: keep the stored session and let the next request retry.
    if (error instanceof AuthError && error.code === REFRESH_REFUSED) {
      setSession(null);
      return null;
    }
    throw error;
  }
}

/** Returns the current session, refreshed first when the ID token is close to expiry. */
export async function currentSession(): Promise<AuthSession | null> {
  const session = getSession();
  if (!session || session.expiresAt - Date.now() > REFRESH_BEFORE_MS) return session;
  refreshing ??= refreshSession(session).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** A signed-in person whose session ended and could not be renewed. The app sends them to the sign-in page. */
export class SessionExpiredError extends Error {
  constructor() {
    super('session_expired');
  }
}

/**
 * The ID token to send with a request, renewed first when it is about to expire (the ID token lasts one hour, so a page
 * left open would otherwise send an expired token). null = nobody signed in. Throws SessionExpiredError when Cognito refused
 * the refresh; the stored session is cleared then. A failed attempt (offline, server error) throws AuthError and keeps the
 * stored session, so the person is not signed out by a network blip.
 */
export async function freshToken(): Promise<string | null> {
  const before = getSession();
  const current = await currentSession();
  if (current) return current.accessToken;
  if (before) throw new SessionExpiredError();
  return null;
}

export async function signOut(): Promise<void> {
  const session = getSession();
  if (session?.cognitoAccessToken) {
    await call('signout', { cognitoAccessToken: session.cognitoAccessToken }).catch(() => null);
  }
  setSession(null);
}
