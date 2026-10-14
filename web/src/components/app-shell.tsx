'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/components/auth-provider';
import { PageTransition, ScrollProgress } from '@/components/motion/primitives';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { motionTokens } from '@/lib/motion-tokens';

export function AppShell({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth();
  const router = useRouter();
  const scrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (ready && !session) router.replace('/connexion');
  }, [ready, session, router]);

  if (!ready || !session) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-slate-500" role="status">
        <motion.span
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          Chargement…
        </motion.span>
      </div>
    );
  }

  return (
    <motion.div
      className="flex h-screen overflow-hidden text-sm text-slate-800 antialiased"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: motionTokens.duration.slow }}
    >
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <ScrollProgress container={scrollRef} />
        <main ref={scrollRef} className="custom-scrollbar flex-1 overflow-y-auto p-6 md:p-8">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </motion.div>
  );
}
