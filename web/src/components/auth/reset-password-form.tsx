'use client';

import Link from 'next/link';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useT } from '@/i18n/provider';
import { validateNewPassword, validateResetEmail, RESET_CODE_LENGTH, type NewPasswordErrors, type ResetProblem } from '@/lib/auth/password-reset';
import { usePasswordReset } from '@/lib/auth/use-password-reset';
import { canMatchMedia, gsap, gsapTokens, MOTION_QUERIES, useGSAP } from '@/lib/gsap';

type Variant = 'erp' | 'site';

const HEADING: Record<Variant, string> = {
  erp: 'text-2xl font-semibold tracking-tight',
  site: 'font-heading-site text-2xl font-bold text-foreground',
};

/** Forgotten password, shared by the ERP and the public site: e-mail, then the code with the new password. */
export function ResetPasswordForm({ signInPath, variant }: { signInPath: string; variant: Variant }) {
  const t = useT().shell.resetPassword;
  const router = useRouter();
  const reset = usePasswordReset();
  const root = useRef<HTMLDivElement>(null);
  const ids = { email: useId(), code: useId(), password: useId(), confirm: useId() };

  const [emailInput, setEmailInput] = useState('');
  const [emailProblem, setEmailProblem] = useState<ResetProblem | null>(null);
  const [fields, setFields] = useState({ code: '', password: '', confirm: '' });
  const [problems, setProblems] = useState<NewPasswordErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [resent, setResent] = useState(false);

  useGSAP(
    () => {
      if (!canMatchMedia() || !root.current) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES.full, () => {
        gsap.from('[data-reset-item]', {
          autoAlpha: 0,
          y: gsapTokens.reveal.distance,
          duration: gsapTokens.reveal.duration,
          stagger: gsapTokens.reveal.stagger,
          ease: gsapTokens.reveal.ease,
          clearProps: 'opacity,visibility,transform',
        });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [reset.step], revertOnUpdate: true },
  );

  const setField = (name: keyof typeof fields) => (value: string) => setFields((current) => ({ ...current, [name]: value }));

  async function handleRequest(event: FormEvent) {
    event.preventDefault();
    const problem = validateResetEmail(emailInput);
    setEmailProblem(problem);
    if (problem) return;
    setResent(false);
    await reset.requestCode(emailInput);
  }

  async function handleConfirm(event: FormEvent) {
    event.preventDefault();
    const found = validateNewPassword(fields);
    setProblems(found);
    if (Object.keys(found).length > 0) return;
    if (await reset.confirm(fields.code, fields.password)) router.replace(`${signInPath}?reset=1`);
  }

  async function handleResend() {
    setResent(false);
    setResent(await reset.requestCode(reset.email));
  }

  const problemText = (problem: ResetProblem | null | undefined, id: string) =>
    problem ? (
      <p id={`${id}-problem`} role="alert" className="mt-1 text-xs font-medium text-destructive">
        {t.problems[problem]}
      </p>
    ) : null;
  const invalid = (problem: ResetProblem | null | undefined, id: string) => ({
    'aria-invalid': problem ? true : undefined,
    'aria-describedby': problem ? `${id}-problem` : undefined,
  });

  const serverError = reset.errorKey ? (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
      {t.errors[reset.errorKey]}
    </p>
  ) : null;

  const backLink = (
    <p data-reset-item="" className="text-center text-sm">
      <Link href={signInPath} className="font-semibold text-primary hover:underline">
        {t.backToSignIn}
      </Link>
    </p>
  );

  if (reset.step === 'email') {
    return (
      <div ref={root} className="space-y-6">
        <div className="space-y-2">
          <h1 data-reset-item="" className={HEADING[variant]}>
            {t.requestTitle}
          </h1>
          <p data-reset-item="" className="text-sm text-muted-foreground">
            {t.requestSubtitle}
          </p>
        </div>
        <form onSubmit={handleRequest} noValidate className="space-y-4">
          <div data-reset-item="">
            <Label htmlFor={ids.email}>{t.email}</Label>
            <Input
              id={ids.email}
              type="email"
              dir="ltr"
              autoComplete="email"
              maxLength={200}
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              className="mt-1.5"
              {...invalid(emailProblem, ids.email)}
            />
            {problemText(emailProblem, ids.email)}
          </div>
          {serverError}
          <Button data-reset-item="" type="submit" size="lg" className="h-11 w-full" disabled={reset.busy}>
            {reset.busy ? (
              <>
                <Loader2 data-icon="inline-start" />
                {t.sending}
              </>
            ) : (
              t.requestSubmit
            )}
          </Button>
        </form>
        {backLink}
      </div>
    );
  }

  return (
    <div ref={root} className="space-y-6">
      <div className="space-y-2">
        <h1 data-reset-item="" className={HEADING[variant]}>
          {t.codeTitle}
        </h1>
        <p data-reset-item="" className="text-sm text-muted-foreground">
          {t.codeSubtitle(reset.email)}
        </p>
      </div>
      <form onSubmit={handleConfirm} noValidate className="space-y-4">
        <div data-reset-item="">
          <Label htmlFor={ids.code}>{t.code}</Label>
          <Input
            id={ids.code}
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={RESET_CODE_LENGTH}
            value={fields.code}
            onChange={(event) => setField('code')(event.target.value)}
            className="mt-1.5"
            {...invalid(problems.code, ids.code)}
          />
          {problemText(problems.code, ids.code)}
        </div>
        <div data-reset-item="">
          <Label htmlFor={ids.password}>{t.newPassword}</Label>
          <div className="relative mt-1.5">
            <Input
              id={ids.password}
              type={showPassword ? 'text' : 'password'}
              dir="ltr"
              autoComplete="new-password"
              value={fields.password}
              onChange={(event) => setField('password')(event.target.value)}
              className="pe-10"
              {...invalid(problems.password, ids.password)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? t.hidePassword : t.showPassword}
              aria-pressed={showPassword}
              className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          </div>
          {problems.password ? problemText(problems.password, ids.password) : <p className="mt-1 text-xs text-muted-foreground">{t.passwordHint}</p>}
        </div>
        <div data-reset-item="">
          <Label htmlFor={ids.confirm}>{t.confirmPassword}</Label>
          <Input
            id={ids.confirm}
            type={showPassword ? 'text' : 'password'}
            dir="ltr"
            autoComplete="new-password"
            value={fields.confirm}
            onChange={(event) => setField('confirm')(event.target.value)}
            className="mt-1.5"
            {...invalid(problems.confirm, ids.confirm)}
          />
          {problemText(problems.confirm, ids.confirm)}
        </div>
        {serverError}
        {resent && !reset.errorKey ? (
          <p role="status" className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success">
            {t.resent}
          </p>
        ) : null}
        <Button data-reset-item="" type="submit" size="lg" className="h-11 w-full" disabled={reset.busy}>
          {reset.busy ? (
            <>
              <Loader2 data-icon="inline-start" />
              {t.saving}
            </>
          ) : (
            t.submit
          )}
        </Button>
      </form>
      <div data-reset-item="" className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button type="button" onClick={handleResend} disabled={reset.busy} className="font-semibold text-primary hover:underline disabled:opacity-50">
          {t.resend}
        </button>
        <button type="button" onClick={reset.changeEmail} className="text-muted-foreground hover:text-foreground hover:underline">
          {t.changeEmail}
        </button>
      </div>
      {backLink}
    </div>
  );
}
