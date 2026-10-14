'use client';

import { usePathname } from 'next/navigation';
import { Bell, Search } from 'lucide-react';
import { SEARCH_PLACEHOLDERS, findTrail, sectionOf } from '@/lib/navigation';

const LANGUAGES = [
  { code: 'FR', label: 'FR' },
  { code: 'AR', label: 'عربية' },
  { code: 'EN', label: 'EN' },
];

export function Topbar() {
  const pathname = usePathname();
  const trail = findTrail(pathname);
  const placeholder = SEARCH_PLACEHOLDERS[sectionOf(pathname)] ?? 'Rechercher…';

  return (
    <header className="z-10 flex h-16 shrink-0 items-center justify-between border-b border-app-border bg-white px-6">
      <nav aria-label="Chemin de navigation" className="flex items-center text-xs font-medium text-slate-500">
        <span className="text-sm font-semibold text-slate-900">{trail.join(' › ')}</span>
      </nav>

      <div className="flex items-center gap-3">
        <label className="relative w-64">
          <span className="sr-only">Rechercher</span>
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-slate-400">
            <Search className="h-3.5 w-3.5" aria-hidden />
          </span>
          <input
            type="text"
            placeholder={placeholder}
            className="w-full rounded-lg border border-app-border bg-slate-50 py-1.5 pl-8 pr-10 text-xs text-slate-800 placeholder-slate-500 transition-colors focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400">⌘K</kbd>
          </span>
        </label>

        <div className="h-4 w-px bg-slate-200" aria-hidden />

        <div
          role="group"
          aria-label="Langue"
          className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-medium"
        >
          {LANGUAGES.map((language) =>
            language.code === 'FR' ? (
              <span key={language.code} className="rounded bg-white px-2 py-0.5 font-semibold text-brand shadow-sm">
                {language.label}
              </span>
            ) : (
              <button key={language.code} type="button" aria-disabled="true" className="cursor-not-allowed rounded px-2 py-0.5 text-slate-500" title="Bientôt disponible">{language.label}</button>
            ),
          )}
        </div>

        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <Bell className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>
    </header>
  );
}
