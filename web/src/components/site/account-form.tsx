'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Eye, EyeOff, Loader2 } from '@/components/icons';
import { useAuth } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n/provider';
import { canMatchMedia, gsap, MOTION_QUERIES, useGSAP } from '@/lib/gsap';
import { accountHref, FORGOT_PASSWORD_PATH, safeSiteNext, SIGN_IN_PATH, SIGN_UP_PATH, validateAccount, type AccountErrors } from '@/lib/site/account';

/** Sign-in and sign-up form of the public site's clients. After success the visitor returns to the page they came from. */
export function AccountForm({ mode }: { mode: 'signin' | 'signup' }) {
  const messages = useT();
  const t = messages.site.account;
  const resetText = messages.shell.resetPassword;
  const { session, ready, signIn, signUp, confirmSignUp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeSiteNext(params.get('next'));
  const passwordWasReset = params.get('reset') === '1';
  const root = useRef<HTMLDivElement>(null);
  const ids = { name: useId(), email: useId(), password: useId(), code: useId() };
  const isSignUp = mode === 'signup';

  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<AccountErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [verify, setVerify] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (ready && session) router.replace(next);
  }, [ready, session, router, next]);

  useGSAP(
    () => {
      if (!canMatchMedia() || !root.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES.full, () => {
        gsap.from('[data-account-item]', { autoAlpha: 0, y: 22, duration: 0.6, stagger: 0.08, ease: 'power3.out', clearProps: 'opacity,visibility,transform' });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const set = (field: keyof typeof values) => (value: string) => setValues((current) => ({ ...current, [field]: value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validateAccount(values, mode);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length > 0) return;
    setSubmitting(true);
    try {
      if (isSignUp) {
        const outcome = await signUp(values.name.trim(), values.email.trim(), values.password);
        if (outcome === 'verify') setVerify(true);
        else router.replace(next);
      } else {
        await signIn(values.email.trim(), values.password);
        router.replace(next);
      }
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : t.errors.other);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    setServerError(null);
    setSubmitting(true);
    try {
      await confirmSignUp(values.email.trim(), code.trim());
      await signIn(values.email.trim(), values.password);
      router.replace(next);
    } catch (caught) {
      setServerError(caught instanceof Error ? caught.message : t.errors.other);
    } finally {
      setSubmitting(false);
    }
  }

  const problem = (field: keyof AccountErrors) =>
    errors[field] ? (
      <p id={`${ids[field]}-problem`} role="alert" className="mt-1 text-xs font-medium text-destructive">
        {t.problems[errors[field]]}
      </p>
    ) : null;
  const invalid = (field: keyof AccountErrors) => ({ 'aria-invalid': errors[field] ? true : undefined, 'aria-describedby': errors[field] ? `${ids[field]}-problem` : undefined });

  if (verify) {
    return (
      <div ref={root} className="mx-auto w-full max-w-md px-4 py-16">
        <div className="rounded-2xl border border-primary/15 bg-card p-8 text-center shadow-lg">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
            <Check className="size-6" aria-hidden="true" />
          </span>
          <h1 data-account-item="" className="font-heading-site text-2xl font-bold">
            {t.checkEmailTitle}
          </h1>
          <p data-account-item="" className="mt-2 text-sm text-muted-foreground">
            {t.checkEmailBody}
          </p>
          <form onSubmit={handleConfirm} noValidate className="mt-6 space-y-4">
            <div data-account-item="">
              <Label htmlFor={ids.code}>{t.codeLabel}</Label>
              <Input
                id={ids.code}
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="mt-1.5"
              />
            </div>
            {serverError ? (
              <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                {serverError}
              </p>
            ) : null}
            <Button data-account-item="" type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
              {submitting ? t.sending : t.codeSubmit}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className="mx-auto w-full max-w-md px-4 py-12 sm:py-16">
      <div className="rounded-2xl border border-primary/15 bg-card p-6 shadow-lg sm:p-8">
        <h1 data-account-item="" className="font-heading-site text-2xl font-bold text-foreground">
          {isSignUp ? t.signUpTitle : t.signInTitle}
        </h1>
        <p data-account-item="" className="mt-2 text-sm text-muted-foreground">
          {isSignUp ? t.signUpIntro : t.signInIntro}
        </p>

        {passwordWasReset && !isSignUp ? (
          <p data-account-item="" role="status" className="mt-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success">
            {resetText.done}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          {isSignUp ? (
            <div data-account-item="">
              <Label htmlFor={ids.name}>{t.name}</Label>
              <Input id={ids.name} autoComplete="name" maxLength={120} value={values.name} onChange={(event) => set('name')(event.target.value)} className="mt-1.5" {...invalid('name')} />
              {problem('name')}
            </div>
          ) : null}
          <div data-account-item="">
            <Label htmlFor={ids.email}>{t.email}</Label>
            <Input
              id={ids.email}
              type="email"
              dir="ltr"
              autoComplete="email"
              maxLength={200}
              value={values.email}
              onChange={(event) => set('email')(event.target.value)}
              className="mt-1.5"
              {...invalid('email')}
            />
            {problem('email')}
          </div>
          <div data-account-item="">
            <Label htmlFor={ids.password}>{t.password}</Label>
            <div className="relative mt-1.5">
              <Input
                id={ids.password}
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                value={values.password}
                onChange={(event) => set('password')(event.target.value)}
                className="pe-10"
                {...invalid('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={t.password}
                aria-pressed={showPassword}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
            {isSignUp && !errors.password ? <p className="mt-1 text-xs text-muted-foreground">{t.passwordHint}</p> : null}
            {problem('password')}
            {!isSignUp ? (
              <Link href={FORGOT_PASSWORD_PATH} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                {resetText.link}
              </Link>
            ) : null}
          </div>

          {serverError ? (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
              {serverError}
            </p>
          ) : null}

          <Button data-account-item="" type="submit" size="lg" className="h-11 w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 data-icon="inline-start" />
                {t.sending}
              </>
            ) : isSignUp ? (
              t.signUpCta
            ) : (
              t.signInCta
            )}
          </Button>
        </form>

        <p data-account-item="" className="mt-6 text-center text-sm text-muted-foreground">
          {isSignUp ? t.haveAccount : t.noAccount}{' '}
          <Link href={accountHref(isSignUp ? SIGN_IN_PATH : SIGN_UP_PATH, next)} className="font-semibold text-primary hover:underline">
            {isSignUp ? t.goSignIn : t.goSignUp}
          </Link>
        </p>
      </div>
    </div>
  );
}
