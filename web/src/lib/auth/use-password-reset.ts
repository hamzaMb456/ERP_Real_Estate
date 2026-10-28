'use client';

import { useState } from 'react';
import { resetErrorKey, type ResetErrorKey } from './password-reset';
import { AuthError, confirmPasswordReset, requestPasswordReset } from './session';

export type ResetStep = 'email' | 'code';

function toErrorKey(error: unknown): ResetErrorKey {
  if (error instanceof AuthError) return resetErrorKey(error.code);
  return error instanceof TypeError ? 'unreachable' : 'other';
}

/** State of the forgotten-password flow: ask for a code, then set the new password with it. */
export function usePasswordReset() {
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<ResetErrorKey | null>(null);

  async function run(action: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setErrorKey(null);
    try {
      await action();
      return true;
    } catch (error) {
      setErrorKey(toErrorKey(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  /** Sends the code to `address` and moves to the second step. Also used to send it again. */
  async function requestCode(address: string): Promise<boolean> {
    const value = address.trim();
    const sent = await run(() => requestPasswordReset(value));
    if (sent) {
      setEmail(value);
      setStep('code');
    }
    return sent;
  }

  /** Sets the new password; `true` when the server accepted the code. */
  function confirm(code: string, newPassword: string): Promise<boolean> {
    return run(() => confirmPasswordReset(email, code.trim(), newPassword));
  }

  function changeEmail(): void {
    setErrorKey(null);
    setStep('email');
  }

  return { step, email, busy, errorKey, requestCode, confirm, changeEmail };
}
