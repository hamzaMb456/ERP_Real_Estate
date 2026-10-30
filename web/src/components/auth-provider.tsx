'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMessages } from '@/i18n/store';
import {
  AuthError,
  completeMfa as completeMfaSignIn,
  completeNewPassword,
  confirmSignUp as confirmAccount,
  currentSession,
  getSession,
  signIn as signInWithCredentials,
  signOut as endSession,
  signUp as registerAccount,
  subscribe,
} from '@/lib/auth/session';
import type { AuthSession } from '@/lib/auth/types';
import { accountErrorKey } from '@/lib/site/account';

type PendingPasswordChange = { email: string; challengeSession: string };
type PendingMfa = { email: string; challengeSession: string; challengeUserId: string };

type AuthState = {
  session: AuthSession | null;
  ready: boolean;
  pendingPasswordChange: PendingPasswordChange | null;
  pendingMfa: PendingMfa | null;
  signIn: (email: string, password: string) => Promise<void>;
  completePasswordChange: (newPassword: string) => Promise<void>;
  completeMfa: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<'verify'>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

function describeSignInError(code: string): string {
  const { auth } = getMessages().shell;
  switch (code) {
    case 'NotAuthorizedException':
    case 'UserNotFoundException':
      return auth.invalidCredentials;
    case 'UserNotConfirmedException':
      return auth.unverified;
    case 'invalid-request':
      return auth.malformed;
    case 'unreachable':
      return auth.unreachable;
    default:
      return auth.other(code, undefined);
  }
}

function describeSignUpError(code: string): string {
  const { account } = getMessages().site;
  return account.errors[accountErrorKey(code)];
}

function toError(error: unknown, describe: (code: string) => string): Error {
  if (error instanceof AuthError) return new Error(describe(error.code));
  if (error instanceof TypeError) return new Error(getMessages().shell.auth.unreachable);
  return error instanceof Error ? error : new Error(String(error));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<PendingPasswordChange | null>(null);
  const [pendingMfa, setPendingMfa] = useState<PendingMfa | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribe((next) => {
      if (active) setSession(next);
    });
    currentSession()
      .catch(() => null)
      .finally(() => {
        if (!active) return;
        setSession(getSession());
        setReady(true);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const result = await signInWithCredentials(email, password);
      if (result.kind === 'new-password') {
        setPending({ email: result.email, challengeSession: result.challengeSession });
      }
      if (result.kind === 'mfa') {
        setPendingMfa({ email: result.email, challengeSession: result.challengeSession, challengeUserId: result.challengeUserId });
      }
    } catch (error) {
      throw toError(error, describeSignInError);
    }
  }, []);

  const completePasswordChange = useCallback(
    async (newPassword: string) => {
      if (!pending) throw new Error(getMessages().shell.auth.noSession);
      try {
        await completeNewPassword(pending.email, newPassword, pending.challengeSession);
        setPending(null);
      } catch (error) {
        throw toError(error, describeSignInError);
      }
    },
    [pending],
  );

  const completeMfa = useCallback(
    async (code: string) => {
      if (!pendingMfa) throw new Error(getMessages().shell.auth.noSession);
      try {
        await completeMfaSignIn(pendingMfa.email, code, pendingMfa.challengeSession, pendingMfa.challengeUserId);
        setPendingMfa(null);
      } catch (error) {
        // A refused code is the common case: say so, instead of the generic sign-in failure.
        if (error instanceof AuthError) throw new Error(getMessages().shell.login.mfaWrong);
        throw toError(error, describeSignInError);
      }
    },
    [pendingMfa],
  );

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<'verify'> => {
    try {
      await registerAccount(name, email, password);
      return 'verify';
    } catch (error) {
      throw toError(error, describeSignUpError);
    }
  }, []);

  const confirmSignUp = useCallback(async (email: string, code: string) => {
    try {
      await confirmAccount(email, code);
    } catch (error) {
      throw toError(error, describeSignUpError);
    }
  }, []);

  const signOut = useCallback(async () => {
    await endSession();
  }, []);

  const value = useMemo(
    () => ({ session, ready, pendingPasswordChange: pending, pendingMfa, signIn, completePasswordChange, completeMfa, signOut, signUp, confirmSignUp }),
    [session, ready, pending, pendingMfa, signIn, completePasswordChange, completeMfa, signOut, signUp, confirmSignUp],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
