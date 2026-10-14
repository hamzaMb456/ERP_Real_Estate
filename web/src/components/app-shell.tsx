'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { AppSidebar } from '@/components/app-sidebar';
import { useAuth } from '@/components/auth-provider';
import { PageTransition, Pulse, ScrollProgress } from '@/components/motion/primitives';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const router = useRouter();
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ready && !session) router.replace('/connexion');
  }, [ready, session, router]);

  if (!ready || !session) {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground" role="status">
        <Pulse>Chargement…</Pulse>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="h-svh overflow-hidden">
        <AppHeader />
        <ScrollProgress container={scrollRef} />
        <main ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
