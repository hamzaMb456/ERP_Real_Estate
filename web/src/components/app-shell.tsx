'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth-provider';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

export function AppShell({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !session) router.replace('/connexion');
  }, [ready, session, router]);

  if (!ready || !session) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500" role="status">
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden text-sm text-slate-800 antialiased">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <main className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
