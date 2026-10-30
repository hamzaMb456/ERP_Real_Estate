'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { useAuth } from '@/components/auth-provider';
import { PageTransition, Pulse, ScrollProgress, ScrollStagger } from '@/components/motion/primitives';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useT } from '@/i18n/provider';
import { isStaffRole } from '@/lib/site/account';
import { useOnline } from '@/lib/use-online';

export function AppShell({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const router = useRouter();
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const online = useOnline();

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      // Remember where the visitor was going: the sign-in page sends them back there (query string included).
      // Read from window, not usePathname/useSearchParams: those would force a Suspense boundary around the whole shell.
      const { pathname, search } = window.location;
      router.replace('/erp/connexion?next=' + encodeURIComponent(pathname + search));
    } else if (!isStaffRole(session.user?.defaultRole ?? '')) {
      // A client account (role "user") must not access the ERP — redirect them to the public site.
      router.replace('/');
    }
  }, [ready, session, router]);

  if (!ready || !session || !isStaffRole(session.user?.defaultRole ?? '')) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground" role="status">
        <Pulse>{t.common.loading}</Pulse>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
      >
        {t.shell.skipToContent}
      </a>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        {!online && (
          <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            {t.shell.offline}
          </div>
        )}
        <AppHeader />
        <ScrollProgress container={scrollRef} />
        <SmoothScroll container={scrollRef} />
        <div ref={scrollRef} id="contenu" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
            <ScrollStagger>
              <PageTransition>{children}</PageTransition>
            </ScrollStagger>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
