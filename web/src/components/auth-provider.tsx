'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StoredSession } from '@nhost/nhost-js';
import { FetchError } from '@nhost/nhost-js/fetch';
import { nhost } from '@/lib/nhost';

type AuthState = {
  session: StoredSession | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

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
        throw new Error('Connexion impossible. Vérifiez votre compte.');
      }
    } catch (error) {
      if (error instanceof FetchError) {
        throw new Error('E-mail ou mot de passe incorrect.');
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
