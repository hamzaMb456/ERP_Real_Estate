'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { NAVIGATION, type NavItem } from '@/lib/navigation';

function isInside(item: NavItem, pathname: string): boolean {
  if (item.children) {
    return item.children.some((child) => pathname === child.href || pathname.startsWith(child.href + '/'));
  }
  if (item.href === '/') return pathname === '/';
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function Sidebar() {
  const pathname = usePathname();
  const { session, signOut } = useAuth();
  const user = session?.user;
  const displayName = user?.displayName || user?.email || 'Utilisateur';

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-line bg-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white">
          <Building2 size={20} aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">ERP Immobilier</p>
          <p className="text-xs text-muted">Emerald ERP System</p>
        </div>
      </div>

      <div className="mx-4 mb-3 rounded-lg border border-line bg-page px-3 py-2">
        <p className="text-sm font-medium text-ink">Immobilière Carthage</p>
        <p className="text-xs text-muted">Toutes les succursales</p>
      </div>

      <nav aria-label="Navigation principale" className="flex-1 overflow-y-auto px-3 pb-3">
        <ul className="flex flex-col gap-0.5">
          {NAVIGATION.map((item) => {
            const active = isInside(item, pathname);
            const Icon = item.icon;
            return (
              <li key={item.label}>
                <Link
                  href={item.children ? item.children[0].href : item.href}
                  aria-current={active && !item.children ? 'page' : undefined}
                  className={
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ' +
                    (active ? 'bg-soft font-medium text-primary' : 'text-muted hover:bg-page hover:text-ink')
                  }
                >
                  <Icon size={18} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.children && <ChevronDown size={14} aria-hidden className={active ? '' : '-rotate-90'} />}
                </Link>
                {item.children && active && (
                  <ul className="ml-6 mt-0.5 flex flex-col gap-0.5 border-l border-line pl-3">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href;
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            aria-current={childActive ? 'page' : undefined}
                            className={
                              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ' +
                              (childActive ? 'bg-soft font-medium text-primary' : 'text-muted hover:text-ink')
                            }
                          >
                            {childActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex items-center gap-3 border-t border-line px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-soft text-sm font-semibold text-primary">
          {initials(displayName)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium text-ink">{displayName}</p>
          <p className="truncate text-xs text-muted">{user?.defaultRole ?? 'Utilisateur'}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label="Se déconnecter"
          className="rounded-lg p-2 text-muted hover:bg-page hover:text-ink"
        >
          <LogOut size={18} aria-hidden />
        </button>
      </div>
    </aside>
  );
}
