'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building, ChevronDown, ChevronRight, ChevronsUpDown, Home, LogOut } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { NAVIGATION, sectionOf, type NavItem } from '@/lib/navigation';

const ROLE_LABELS: Record<string, string> = {
  org_admin: 'Administrateur',
  manager: 'Gestionnaire',
  viewer: 'Lecture seule',
};

function isActive(item: NavItem, pathname: string): boolean {
  return item.href === sectionOf(pathname);
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const ITEM_BASE = 'flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors';
const ITEM_IDLE = 'text-slate-600 font-medium hover:text-slate-900 hover:bg-slate-50';

export function Sidebar() {
  const pathname = usePathname();
  const { session, signOut } = useAuth();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const user = session?.user;
  const displayName = user?.displayName || user?.email || 'Utilisateur';

  function isOpen(item: NavItem): boolean {
    return toggled[item.label] ?? isActive(item, pathname);
  }

  function toggle(item: NavItem) {
    setToggled((current) => ({ ...current, [item.label]: !isOpen(item) }));
  }

  return (
    <aside className="z-20 flex w-64 shrink-0 select-none flex-col border-r border-app-border bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-app-border px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand font-bold text-white shadow-sm">
          <Building className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold leading-tight text-slate-900">ERP Immobilier</h1>
          <p className="truncate text-xs text-slate-500">Emerald ERP System</p>
        </div>
      </div>

      <div className="border-b border-app-border p-3">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-app-border bg-white p-2 text-left transition-colors hover:bg-slate-50"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-50 text-brand">
              <Home className="h-3.5 w-3.5" aria-hidden />
            </div>
            <div className="truncate">
              <div className="truncate text-xs font-semibold leading-tight text-slate-800">Immobilière Carthage</div>
              <div className="truncate text-[11px] leading-tight text-slate-500">Toutes les succursales</div>
            </div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
        </button>
      </div>

      <nav aria-label="Navigation principale" className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        {NAVIGATION.map((item) => {
          const Icon = item.icon;
          const active = isActive(item, pathname);
          const open = isOpen(item);

          if (!item.children) {
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={ITEM_BASE + ' ' + (active ? 'bg-emerald-50 font-semibold text-brand' : ITEM_IDLE)}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={'h-4 w-4 ' + (active ? 'text-brand' : 'text-slate-400')} aria-hidden />
                  <span>{item.label}</span>
                </div>
                {active && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />}
              </Link>
            );
          }

          return (
            <div key={item.label} className={item.separated ? 'border-t border-slate-100 pt-2' : undefined}>
              <button
                type="button"
                onClick={() => toggle(item)}
                aria-expanded={open}
                className={ITEM_BASE + ' w-full ' + (active ? 'font-semibold text-slate-900 hover:bg-slate-50' : ITEM_IDLE)}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={'h-4 w-4 ' + (active ? 'text-brand' : 'text-slate-400')} aria-hidden />
                  <span>{item.label}</span>
                </div>
                {open ? (
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                )}
              </button>
              {open && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
                  {item.children.map((child) => {
                    const childActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        aria-current={childActive ? 'page' : undefined}
                        className={
                          'block rounded px-2.5 py-1.5 text-xs ' +
                          (childActive
                            ? 'bg-emerald-50 font-semibold text-brand'
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900')
                        }
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="flex items-center justify-between border-t border-app-border bg-white p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-brand">
            {initials(displayName)}
          </div>
          <div className="truncate">
            <div className="truncate text-xs font-semibold leading-tight text-slate-900">{displayName}</div>
            <div className="truncate text-[11px] leading-tight text-slate-500">
              {ROLE_LABELS[user?.defaultRole ?? ''] ?? 'Utilisateur'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          title="Déconnexion"
          aria-label="Se déconnecter"
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
