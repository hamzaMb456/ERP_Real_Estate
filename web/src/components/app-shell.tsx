'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { useAuth } from '@/components/auth-provider';
import { PageTransition, Pulse, ScrollProgress } from '@/components/motion/primitives';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useT } from '@/i18n/provider';

export function AppShell({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const router = useRouter();
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ready && !session) router.replace('/connexion');
  }, [ready, session, router]);

  if (!ready || !session) {
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
        <AppHeader />
        <ScrollProgress container={scrollRef} />
        <div ref={scrollRef} id="contenu" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
