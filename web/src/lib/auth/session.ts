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

/** Returns the current session, refreshed first when the ID token is close to expiry. */
export async function currentSession(): Promise<AuthSession | null> {
  const session = getSession();
  if (!session || session.expiresAt - Date.now() > REFRESH_BEFORE_MS) return session;
  if (!session.refreshToken) {
    setSession(null);
    return null;
  }
  try {
    const data = await call<{ session: AuthSession }>('refresh', { refreshToken: session.refreshToken });
    setSession(data.session);
    return data.session;
  } catch {
    setSession(null);
    return null;
  }
}

export async function signOut(): Promise<void> {
  const session = getSession();
  if (session?.cognitoAccessToken) {
    await call('signout', { cognitoAccessToken: session.cognitoAccessToken }).catch(() => null);
  }
  setSession(null);
}
