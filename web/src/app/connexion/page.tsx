'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Check, Eye, EyeOff, Loader2, LockKeyhole } from '@/components/icons';
import { useAuth } from '@/components/auth-provider';
import { staggerContainer, staggerItem } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useT } from '@/i18n/provider';
import { motionTokens, springs } from '@/lib/motion-tokens';

export default function ConnexionPage() {
  const { session, ready, signIn } = useAuth();
  const router = useRouter();
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && session) router.replace('/');
  }, [ready, session, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t.shell.login.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="grid-pattern pointer-events-none absolute inset-0" />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -start-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl motion-reduce:hidden"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -end-20 size-[28rem] rounded-full bg-white/15 blur-3xl motion-reduce:hidden"
          animate={{ x: [0, -50, 0], y: [0, -40, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute start-1/3 top-1/2 size-64 rounded-full border border-white/20 motion-reduce:hidden"
          animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeOut' }}
        />
        <div className="relative flex items-center gap-3">
          <motion.span
            className="flex size-10 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            whileHover={{ rotate: 12, scale: 1.12 }}
            transition={springs.bouncy}
          >
            <Building2 className="size-5" />
          </motion.span>
          <div>
            <p className="text-lg font-semibold leading-tight">{t.common.appName}</p>
            <p className="text-xs text-primary-foreground/85">{t.shell.login.tagline}</p>
          </div>
        </div>

        <div className="relative max-w-lg space-y-8">
          <div className="space-y-4">
            <p className="text-4xl font-semibold leading-tight tracking-tight text-balance">
              {t.shell.login.headline}
            </p>
            <p className="text-lg text-primary-foreground/90">
              {t.shell.login.subline}
            </p>
          </div>
          <motion.ul className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
            {t.shell.login.features.map((feature) => (
              <motion.li key={feature} variants={staggerItem} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <Check className="size-3.5" />
                </span>
                <span className="font-medium">{feature}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <p className="relative text-xs text-primary-foreground/85">{t.shell.login.footer}</p>
      </aside>

      <main className="relative flex items-center justify-center p-6 sm:p-10">
        <LanguageSwitcher variant="labeled" className="absolute end-4 top-4" />
        <motion.div
          className="w-full max-w-sm space-y-8"
          initial={{ opacity: 0, y: motionTokens.distance.xl, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={springs.gentle}
        >
          <div className="space-y-2">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
              <Building2 className="size-5" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">{t.shell.login.title}</h1>
            <p className="text-sm text-muted-foreground">{t.shell.login.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup>
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
              </Field>
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
              {submitting ? t.shell.login.submitting : t.shell.login.submit}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">{t.shell.login.support}</p>
        </motion.div>
      </main>
    </div>
  );
}
