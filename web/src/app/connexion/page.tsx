'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building, Check, Eye, EyeOff, Lock, Phone, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

const FEATURES = [
  'Loyers, paiements et relances au même endroit',
  'Maintenance et fournisseurs suivis de bout en bout',
  'Ventes et réservations centralisées',
];

const INPUT =
  'w-full h-[44px] rounded-lg border border-[#bdc9c1] bg-white text-base text-[#0e1f17] placeholder:text-[#6e7a73] transition-all duration-150 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2';

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
    <main className="flex min-h-screen w-full flex-col bg-white text-[#0e1f17] antialiased lg:flex-row">
      <section className="relative flex w-full flex-col justify-between overflow-hidden bg-brand p-8 text-white sm:p-12 lg:w-1/2 lg:p-16">
        <div aria-hidden className="grid-pattern pointer-events-none absolute inset-0 opacity-80" />
        <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-white opacity-5 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#7bd8b1] opacity-10 blur-3xl" />

        <header className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/30 bg-white/10 shadow-sm backdrop-blur-sm">
            <Building className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight">Emerald ERP Immobilier</span>
            <span className="block text-xs font-medium uppercase tracking-wide text-white/80">
              Tunisie · Plateforme Gestion Foncière
            </span>
          </div>
        </header>

        <div className="relative z-10 my-12 max-w-xl lg:my-auto">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-xs font-semibold tracking-wide text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#7bd8b1]" />
            Solution de gestion immobilière d’entreprise
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Gérez votre patrimoine immobilier en toute simplicité
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/90 sm:text-lg">
            La plateforme unifiée conçue pour les cabinets d’administration de biens, promoteurs et syndics
            professionnels en Tunisie.
          </p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/30 bg-white/20">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </div>
                <div className="text-sm font-medium text-white sm:text-base">{feature}</div>
              </li>
            ))}
          </ul>
        </div>

        <footer className="relative z-10 flex flex-col justify-between gap-2 border-t border-white/15 pt-6 text-xs text-white/80 sm:flex-row sm:items-center">
          <p className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Conforme aux réglementations et normes immobilières locales
          </p>
          <p>v3.4.2 · © 2025 Emerald ERP</p>
        </footer>
      </section>

      <section className="flex w-full flex-col justify-between bg-white p-6 sm:p-10 lg:w-1/2 lg:p-16">
        <div className="flex w-full items-center justify-end">
          <nav
            aria-label="Sélecteur de langue"
            className="inline-flex items-center rounded-lg border border-[#bdc9c1]/50 bg-[#e4f8eb] p-1"
          >
            <span aria-current="page" className="rounded bg-brand px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
              FR
            </span>
            <span className="cursor-not-allowed px-3 py-1.5 text-xs font-medium text-[#3e4943]" dir="rtl" lang="ar" title="Bientôt disponible">
              عربية
            </span>
            <span className="cursor-not-allowed px-3 py-1.5 text-xs font-medium text-[#3e4943]" title="Bientôt disponible">
              EN
            </span>
          </nav>
        </div>

        <div className="mx-auto my-auto w-full max-w-md py-8">
          <div className="mb-8 text-left">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Connexion</h2>
            <p className="mt-2 text-sm text-[#3e4943] sm:text-base">Accédez à l’espace de votre organisation</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold">
                Adresse e-mail professionnelle <span aria-hidden className="text-[#ba1a1a]">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="nom@societe.tn"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={INPUT + ' px-3.5 py-2.5'}
              />
              <p className="mt-1.5 text-xs text-[#3e4943]">Utilisez votre compte de domaine d’entreprise vérifié.</p>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold">
                Mot de passe <span aria-hidden className="text-[#ba1a1a]">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={INPUT + ' py-2.5 pl-3.5 pr-12'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-[#6e7a73] transition-colors hover:text-[#0e1f17] focus:text-brand focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <input id="remember_me" name="remember_me" type="checkbox" className="h-4 w-4 rounded border-[#bdc9c1] accent-brand" />
                <label htmlFor="remember_me" className="ml-2.5 block cursor-pointer select-none text-sm font-medium">
                  Se souvenir de moi
                </label>
              </div>
              <span className="cursor-not-allowed font-semibold text-[#005d42]" title="Bientôt disponible">
                Mot de passe oublié ?
              </span>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex h-[44px] w-full items-center justify-center rounded-lg bg-brand text-base font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[#005d42] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 active:scale-[0.99] disabled:opacity-60"
            >
              {submitting ? 'Connexion…' : 'Se connecter'}
            </button>
          </form>

          <div className="relative my-8">
            <div aria-hidden className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#bdc9c1]/60" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 font-medium tracking-wider text-[#3e4943]">Nouveau sur la plateforme ?</span>
            </div>
          </div>

          <div className="text-center text-sm text-[#3e4943]">
            <span>Pas encore de compte ? </span>
            <span className="cursor-not-allowed font-semibold text-[#005d42]" title="Bientôt disponible">
              Créer un compte
            </span>
          </div>
        </div>

        <footer className="flex w-full flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-[#bdc9c1]/40 pt-6 text-xs text-[#3e4943]">
          <div className="inline-flex items-center gap-1.5 font-medium">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Connexion sécurisée SSL 256-bit
          </div>
          <span aria-hidden className="text-[#bdc9c1]">
            •
          </span>
          <div className="inline-flex items-center gap-1.5 font-medium">
            <Phone className="h-3.5 w-3.5" aria-hidden />
            Support Tunis : <span className="font-mono text-[#0e1f17]">+216 71 890 000</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
