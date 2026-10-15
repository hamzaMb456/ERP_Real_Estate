'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Building2, Check, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { staggerContainer, staggerItem } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { motionTokens } from '@/lib/motion-tokens';

const FEATURES = [
  'Loyers, paiements et relances au même endroit',
  'Maintenance et fournisseurs suivis de bout en bout',
  'Ventes et réservations centralisées',
];

export default function ConnexionPage() {
  const { session, ready, signIn } = useAuth();
  const router = useRouter();
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
      setError(caught instanceof Error ? caught.message : 'Connexion impossible.');
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
          className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl motion-reduce:hidden"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/25">
            <Building2 className="size-5" />
          </span>
          <div>
            <p className="text-lg font-semibold leading-tight">ERP Immobilier</p>
            <p className="text-xs text-primary-foreground/85">Plateforme de gestion foncière · Tunisie</p>
          </div>
        </div>

        <div className="relative max-w-lg space-y-8">
          <div className="space-y-4">
            <p className="text-4xl font-semibold leading-tight tracking-tight text-balance">
              Gérez votre patrimoine immobilier en toute simplicité
            </p>
            <p className="text-lg text-primary-foreground/90">
              La plateforme unifiée pour les agences, promoteurs et syndics professionnels.
            </p>
          </div>
          <motion.ul className="space-y-4" variants={staggerContainer} initial="hidden" animate="visible">
            {FEATURES.map((feature) => (
              <motion.li key={feature} variants={staggerItem} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25">
                  <Check className="size-3.5" />
                </span>
                <span className="font-medium">{feature}</span>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        <p className="relative text-xs text-primary-foreground/85">© 2025 Emerald ERP · Conforme aux normes immobilières locales</p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <motion.div
          className="w-full max-w-sm space-y-8"
          initial={{ opacity: 0, y: motionTokens.distance.lg }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
        >
          <div className="space-y-2">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden">
              <Building2 className="size-5" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">Connexion</h1>
            <p className="text-sm text-muted-foreground">Accédez à l’espace de votre organisation.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="email">Adresse e-mail professionnelle</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="nom@societe.tn"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
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
                      aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
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
                  transition={{ duration: 0.45 }}
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
              {submitting ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">Connexion sécurisée · Support Tunis : +216 71 890 000</p>
        </motion.div>
      </main>
    </div>
  );
}
