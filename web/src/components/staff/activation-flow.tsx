'use client';

import Link from 'next/link';
import QRCode from 'qrcode';
import { useEffect, useState, type FormEvent } from 'react';
import { Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useT } from '@/i18n/provider';
import { STRONG_PASSWORD } from '@/lib/auth/password-reset';
import { erpPath } from '@/lib/erp-paths';

type Step = 'checking' | 'invalid' | 'password' | 'authenticator' | 'done';
type Person = { email: string; name: string };
type Enrolment = { setupKey: string; otpauthUrl: string; accessToken: string };

/** One call to the activation route; a refused call throws the route error code. */
async function activate<T>(action: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/staff/activate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...body }),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? 'activation-failed');
  return data;
}

/** The screens behind an invitation link: choose a password, set up the authenticator app, done. */
export function ActivationFlow({ token }: { token: string }) {
  const t = useT().shell.activation;
  const [step, setStep] = useState<Step>('checking');
  const [person, setPerson] = useState<Person | null>(null);
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [qr, setQr] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    activate<Person>('check', { token })
      .then((found) => {
        if (!current) return;
        setPerson(found);
        setStep('password');
      })
      .catch(() => current && setStep('invalid'));
    return () => {
      current = false;
    };
  }, [token]);

  useEffect(() => {
    if (!enrolment) return;
    let current = true;
    QRCode.toDataURL(enrolment.otpauthUrl, { margin: 1, width: 224 })
      .then((url) => current && setQr(url))
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [enrolment]);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) return setError(t.passwordMismatch);
    if (!STRONG_PASSWORD.test(password)) return setError(t.passwordWeak);
    setBusy(true);
    try {
      setEnrolment(await activate<Enrolment>('setpassword', { token, password }));
      setStep('authenticator');
    } catch (caught) {
      setError(caught instanceof Error && caught.message === 'invalid-password' ? t.passwordWeak : t.failed);
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrolment) return;
    setError(null);
    setBusy(true);
    try {
      await activate('verify', { token, code: code.trim(), accessToken: enrolment.accessToken });
      setStep('done');
    } catch (caught) {
      setError(caught instanceof Error && caught.message === 'invalid-code' ? t.wrongCode : t.failed);
    } finally {
      setBusy(false);
    }
  }

  const alert = error && (
    <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {error}
    </p>
  );

  if (step === 'checking') return <p className="text-sm text-muted-foreground">{t.checking}</p>;
  if (step === 'invalid') return <p role="alert" className="text-sm text-destructive">{t.invalid}</p>;
  if (step === 'done') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t.doneTitle}</h1>
        <p className="text-sm text-muted-foreground">{t.doneBody}</p>
        <Button asChild size="lg" className="w-full">
          <Link href={erpPath('/connexion')}>{t.signIn}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{person ? t.hello(person.name) : ''}</p>
      </div>

      {step === 'password' ? (
        <form onSubmit={submitPassword} className="space-y-6">
          <p className="text-sm font-medium">{t.passwordStep}</p>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="activation-password">{t.password}</FieldLabel>
              <Input id="activation-password" type="password" required autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="activation-confirm">{t.confirmPassword}</FieldLabel>
              <Input id="activation-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            </Field>
          </FieldGroup>
          {alert}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 data-icon="inline-start" />}
            {t.continue}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="space-y-6">
          <p className="text-sm font-medium">{t.authenticatorStep}</p>
          <p className="text-sm text-muted-foreground">{t.authenticatorHelp}</p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- a data URL made on this page, nothing to optimise
            <img src={qr} alt="QR" width={224} height={224} className="rounded-lg border bg-white p-2" />
          )}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t.setupKey}</p>
            <p dir="ltr" className="select-all break-all font-mono text-sm">{enrolment?.setupKey}</p>
          </div>
          <Field>
            <FieldLabel htmlFor="activation-code">{t.code}</FieldLabel>
            <Input id="activation-code" inputMode="numeric" autoComplete="one-time-code" required dir="ltr" value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
          {alert}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy && <Loader2 data-icon="inline-start" />}
            {t.verify}
          </Button>
        </form>
      )}
    </div>
  );
}
