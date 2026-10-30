'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Eye, EyeOff, Loader2, LockKeyhole } from '@/components/icons';
import { useAuth } from '@/components/auth-provider';
import { AuthSplitLayout } from '@/components/auth/auth-split-layout';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { useT } from '@/i18n/provider';
import { STRONG_PASSWORD } from '@/lib/auth/password-reset';
import { erpPath, safeNext } from '@/lib/erp-paths';

export default function ConnexionPage() {
  // useSearchParams reads the request's query string, so it needs a Suspense boundary under cacheComponents.
  return (
    <Suspense fallback={null}>
      <ConnexionForm />
    </Suspense>
  );
}

function ConnexionForm() {
  const { session, ready, signIn, pendingPasswordChange, completePasswordChange, pendingMfa, completeMfa } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const destination = safeNext(params.get('next'));
  const passwordWasReset = params.get('reset') === '1';
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace(destination);
  }, [ready, session, router, destination]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (pendingMfa) {
        await completeMfa(code.trim());
      } else if (pendingPasswordChange) {
        if (newPassword !== confirmNewPassword) throw new Error(t.shell.login.newPasswordMismatch);
        if (!STRONG_PASSWORD.test(newPassword)) throw new Error(t.shell.login.newPasswordWeak);
        await completePasswordChange(newPassword);
      } else {
        await signIn(email, password);
      }
      router.replace(destination);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.shell.login.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthSplitLayout>
      <div className="space-y-2">
        <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
          <Building2 className="size-5" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">
          {pendingMfa ? t.shell.login.mfaTitle : pendingPasswordChange ? t.shell.login.newPasswordTitle : t.shell.login.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {pendingMfa ? t.shell.login.mfaSubtitle : pendingPasswordChange ? t.shell.login.newPasswordSubtitle : t.shell.login.subtitle}
        </p>
      </div>

      {passwordWasReset && !pendingPasswordChange ? (
        <p role="status" className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success">
          {t.shell.resetPassword.done}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6">
        <FieldGroup>
          {pendingMfa ? (
            <Field>
              <FieldLabel htmlFor="mfa-code">{t.shell.login.mfaCode}</FieldLabel>
              <Input
                id="mfa-code"
                inputMode="numeric"
                required
                autoComplete="one-time-code"
                dir="ltr"
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </Field>
          ) : pendingPasswordChange ? (
            <>
              <Field>
                <FieldLabel htmlFor="new-password">{t.shell.login.newPassword}</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">{t.shell.login.confirmPassword}</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirmNewPassword}
                  onChange={(event) => setConfirmNewPassword(event.target.value)}
                />
              </Field>
            </>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor="email">{t.shell.login.email}</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder={t.shell.login.emailPlaceholder}
                  dir="ltr"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">{t.shell.login.password}</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <LockKeyhole />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={showPassword ? t.shell.login.hidePassword : t.shell.login.showPassword}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <Link href={erpPath('/mot-de-passe-oublie')} className="self-end text-sm font-medium text-primary hover:underline">
                  {t.shell.resetPassword.link}
                </Link>
              </Field>
            </>
          )}
        </FieldGroup>

        <AnimatePresence>
          {error && (
            <motion.p
              key={error}
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              initial={{ opacity: 0, x: 0 }}
              animate={{ opacity: 1, x: [0, -8, 8, -5, 5, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting && <Loader2 data-icon="inline-start" />}
          {submitting ? t.shell.login.submitting : pendingMfa ? t.shell.login.mfaSubmit : pendingPasswordChange ? t.shell.login.newPasswordSubmit : t.shell.login.submit}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">{t.shell.login.support}</p>
    </AuthSplitLayout>
  );
}
