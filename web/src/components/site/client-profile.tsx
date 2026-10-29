'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useContext, useEffect } from 'react';
import { ArrowLeft, KeyRound, LogOut, Mail, User } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { AuthContext } from '@/components/auth-provider';
import { useT } from '@/i18n/provider';
import { accountHref, SIGN_IN_PATH } from '@/lib/site/account';
import { useClientSession } from '@/components/site/account-menu';
import { cn } from '@/lib/utils';

export function ClientProfile() {
  const t = useT().site.profile;
  const { ready, signedIn, name, email } = useClientSession();
  const signOut = useContext(AuthContext)?.signOut ?? (() => Promise.resolve());
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !signedIn) router.replace(accountHref(SIGN_IN_PATH, pathname));
  }, [ready, signedIn, router, pathname]);

  if (!ready || !signedIn) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <p className="text-sm text-muted-foreground">{t.loading}</p>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/compte"
          className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft className="size-4" animation="none" />
          {t.back}
        </Link>
      </div>

      <header className="border-b border-border pb-6">
        <h1 className="font-heading-site text-3xl font-bold tracking-tight text-foreground">{t.title}</h1>
        <p className="mt-2 text-muted-foreground">{t.subtitle}</p>
      </header>

      {/* Profile Details Card */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-3 border-b border-border/60 pb-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
            <User className="size-5" animation="none" />
          </span>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t.name}</h2>
            <p className="text-lg font-medium text-foreground">{name || t.noName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
            <Mail className="size-5" animation="none" />
          </span>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t.email}</h2>
            <p className="text-lg font-medium text-foreground">{email}</p>
          </div>
        </div>
      </section>

      {/* Password Management Card */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
            <KeyRound className="size-5" animation="none" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">{t.passwordTitle}</h2>
            <p className="text-xs text-muted-foreground">{t.passwordText}</p>
          </div>
        </div>

        <div className="pt-2">
          <Link
            href="/compte/mot-de-passe-oublie"
            className={cn(buttonVariants({ variant: 'outline', size: 'default' }), 'gap-2')}
          >
            {t.changePassword}
          </Link>
        </div>
      </section>

      {/* Sign-out button */}
      <div className="pt-4 flex justify-end">
        <Button
          type="button"
          variant="destructive"
          size="default"
          onClick={() => void handleSignOut()}
          className="gap-2"
        >
          <LogOut className="size-4" />
          {t.logout}
        </Button>
      </div>
    </div>
  );
}
