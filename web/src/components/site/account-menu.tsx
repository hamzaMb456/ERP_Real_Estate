'use client';
import { useContext } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, User } from '@/components/icons';
import { useAuth, AuthContext } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n/provider';
import { accountHref, SIGN_IN_PATH } from '@/lib/site/account';

/** Who is signed in on the public site: whether the session is known yet, the client's name and the token for the server actions. */
export function useClientSession(): { ready: boolean; signedIn: boolean; name: string; email: string; token: string | null } {
  // Use useContext directly so this hook is safe outside AuthProvider (e.g. in tests rendered without it).
  const ctx = useContext(AuthContext);
  const session = ctx?.session ?? null;
  const ready = ctx?.ready ?? false;
  const user = session?.user;
  return {
    ready,
    signedIn: Boolean(session),
    name: user?.displayName?.trim() || user?.email?.split('@')[0] || '',
    email: user?.email ?? '',
    token: session?.accessToken ?? null,
  };
}

/** Header entry: « Se connecter » when signed out, the client's name and a sign-out button when signed in. */
export function AccountMenu({ className }: { className?: string }) {
  const t = useT().site.account;
  const { ready, signedIn, name } = useClientSession();
  const signOut = useContext(AuthContext)?.signOut ?? (() => Promise.resolve());
  const pathname = usePathname();

  // When there is no AuthProvider (e.g. in tests), ctx is null → treat as signed-out immediately (skip spinner).
  // When AuthProvider is mounted but not ready yet, show an empty placeholder.
  const hasProvider = useContext(AuthContext) !== null;
  if (!ready && hasProvider) return <span className={className} aria-hidden="true" />;
  if (!signedIn) {
    return (
      <Button asChild variant="outline" size="lg" className={className}>
        <Link href={accountHref(SIGN_IN_PATH, pathname)}>
          <User data-icon="inline-start" />
          {t.signInCta}
        </Link>
      </Button>
    );
  }
  return (
    <div className={className}>
      <Link href="/compte" className="inline-flex max-w-40 items-center gap-1.5 truncate text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm">
        <User className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="truncate">{name}</span>
      </Link>
      <Button type="button" variant="ghost" size="icon-lg" aria-label={t.logout} onClick={() => void signOut()}>
        <LogOut aria-hidden="true" />
      </Button>
    </div>
  );
}
