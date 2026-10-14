'use client';

import { usePathname } from 'next/navigation';
import { Bell, ChevronRight, Search } from 'lucide-react';
import { findTrail } from '@/lib/navigation';

const LANGUAGES = [
  { code: 'FR', label: 'FR', active: true },
  { code: 'AR', label: 'عربية', active: false },
  { code: 'EN', label: 'EN', active: false },
];

export function Topbar() {
  const pathname = usePathname();
  const trail = findTrail(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-line bg-white px-6">
      <nav aria-label="Chemin de navigation" className="flex min-w-0 items-center gap-1 text-sm text-muted">
        <span>Accueil</span>
        {trail.map((label, index) => (
          <span key={label} className="flex items-center gap-1">
            <ChevronRight size={14} aria-hidden />
            <span className={index === trail.length - 1 ? 'font-medium text-ink' : ''}>{label}</span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-4">
        <label className="relative hidden md:block">
          <span className="sr-only">Rechercher</span>
          <Search size={16} aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Rechercher…"
            className="h-9 w-64 rounded-lg border border-line bg-page pl-9 pr-12 text-sm text-ink placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line bg-white px-1.5 text-[11px] text-muted">
            ⌘K
          </kbd>
        </label>

        <div role="group" aria-label="Langue" className="flex items-center gap-1 text-sm">
          {LANGUAGES.map((language) => (
            <button
              key={language.code}
              type="button"
              aria-pressed={language.active}
              disabled={!language.active}
              className={
                'rounded-lg px-2 py-1 ' +
                (language.active ? 'bg-soft font-medium text-primary' : 'text-muted opacity-60')
              }
            >
              {language.label}
            </button>
          ))}
        </div>

        <button type="button" aria-label="Notifications" className="rounded-lg p-2 text-muted hover:bg-page hover:text-ink">
          <Bell size={18} aria-hidden />
        </button>
      </div>
    </header>
  );
}
