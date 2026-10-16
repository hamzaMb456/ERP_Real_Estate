'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StoredSession } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';
import { getMessages } from '@/i18n/store';
import { nhost } from '@/lib/nhost';

type AuthState = {
  session: StoredSession | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function describeSignInError(code: string | undefined, serverMessage: string | undefined, status: number): string {
  const { auth } = getMessages().shell;
  switch (code) {
    case 'invalid-email-password':
      return auth.invalidCredentials;
    case 'unverified-user':
      return auth.unverified;
    case 'disabled-user':
      return auth.disabled;
    case 'invalid-request':
      return auth.malformed;
    default:
      return auth.other(code ?? auth.errorStatus(status), serverMessage);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = nhost.sessionStorage.onChange((next) => {
      if (active) setSession(next);
    });
    nhost
      .refreshSession()
      .catch(() => null)
      .finally(() => {
        if (!active) return;
        setSession(nhost.getUserSession());
        setReady(true);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const response = await nhost.auth.signInEmailPassword({ email, password });
      if (!response.body.session) {
        throw new Error(getMessages().shell.auth.noSession);
      }
    } catch (error) {
      if (error instanceof FetchError) {
        const body = error.body as { error?: string; message?: string } | null;
        throw new Error(describeSignInError(body?.error, body?.message, error.status));
      }
      if (error instanceof TypeError) {
        throw new Error(getMessages().shell.auth.unreachable);
      }
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const current = nhost.getUserSession();
    if (current) {
      await nhost.auth.signOut({ refreshToken: current.refreshToken }).catch(() => null);
    }
    nhost.clearSession();
  }, []);

  const value = useMemo(() => ({ session, ready, signIn, signOut }), [session, ready, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
