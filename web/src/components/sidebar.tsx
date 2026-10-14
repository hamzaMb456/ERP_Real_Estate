'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Building, ChevronRight, ChevronsUpDown, Home, LogOut } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { MotionLink } from '@/components/motion/primitives';
import { NAVIGATION, sectionOf, type NavItem } from '@/lib/navigation';
import { motionTokens, springs } from '@/lib/motion-tokens';

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

const ITEM_BASE = 'relative flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors duration-150';
const ITEM_IDLE = 'font-medium text-slate-600 hover:text-slate-900';

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
    <motion.aside
      className="z-20 flex w-64 shrink-0 select-none flex-col border-r border-app-border bg-white"
      initial={{ x: -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
    >
      <div className="flex h-16 items-center gap-3 border-b border-app-border px-4">
        <motion.div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand font-bold text-white shadow-sm"
          whileHover={{ rotate: -6, scale: motionTokens.scale.pop }}
          whileTap={{ scale: motionTokens.scale.press }}
          transition={springs.bouncy}
        >
          <Building className="h-5 w-5" aria-hidden />
        </motion.div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-slate-900">ERP Immobilier</p>
          <p className="truncate text-xs text-slate-500">Emerald ERP System</p>
        </div>
      </div>

      <div className="border-b border-app-border p-3">
        <motion.button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-app-border bg-white p-2 text-left transition-colors hover:bg-slate-50"
          whileTap={{ scale: 0.98 }}
          transition={springs.snappy}
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
        </motion.button>
      </div>

      <nav aria-label="Navigation principale" className="custom-scrollbar flex-1 space-y-1 overflow-y-auto px-2.5 py-3">
        {NAVIGATION.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item, pathname);
          const open = isOpen(item);

          return (
            <motion.div
              key={item.label}
              layout="position"
              className={item.separated ? 'border-t border-slate-100 pt-2' : undefined}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...springs.gentle, delay: 0.1 + index * 0.04, layout: springs.snappy }}
            >
              {!item.children ? (
                <MotionLink
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={ITEM_BASE + ' ' + (active ? 'font-semibold text-brand' : ITEM_IDLE)}
                  whileHover={active ? undefined : { x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  transition={springs.snappy}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-lg bg-emerald-50"
                      transition={springs.snappy}
                    />
                  )}
                  <div className="relative z-10 flex items-center gap-2.5">
                    <Icon className={'h-4 w-4 ' + (active ? 'text-brand' : 'text-slate-400')} aria-hidden />
                    <span>{item.label}</span>
                  </div>
                  {active && (
                    <motion.span
                      className="relative z-10 h-1.5 w-1.5 rounded-full bg-brand"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={springs.bouncy}
                      aria-hidden
                    />
                  )}
                </MotionLink>
              ) : (
                <>
                  <motion.button
                    type="button"
                    onClick={() => toggle(item)}
                    aria-expanded={open}
                    className={ITEM_BASE + ' w-full ' + (active ? 'font-semibold text-slate-900' : ITEM_IDLE)}
                    whileHover={{ x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    transition={springs.snappy}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={'h-4 w-4 ' + (active ? 'text-brand' : 'text-slate-400')} aria-hidden />
                      <span>{item.label}</span>
                    </div>
                    <motion.span animate={{ rotate: open ? 90 : 0 }} transition={springs.snappy}>
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                    </motion.span>
                  </motion.button>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div
                        key="children"
                        className="ml-4 mt-0.5 space-y-0.5 border-l border-slate-200 pl-3"
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={{ duration: motionTokens.duration.fast, ease: motionTokens.easing.smooth }}
                      >
                        {item.children.map((child) => {
                          const childActive = pathname === child.href;
                          return (
                            <MotionLink
                              key={child.href}
                              href={child.href}
                              aria-current={childActive ? 'page' : undefined}
                              className={
                                'relative block rounded px-2.5 py-1.5 text-xs transition-colors ' +
                                (childActive ? 'font-semibold text-brand' : 'text-slate-500 hover:text-slate-900')
                              }
                              whileHover={childActive ? undefined : { x: 2 }}
                              whileTap={{ scale: 0.98 }}
                              transition={springs.snappy}
                            >
                              {childActive && (
                                <motion.span
                                  layoutId="nav-child-active"
                                  className="absolute inset-0 rounded bg-emerald-50"
                                  transition={springs.snappy}
                                />
                              )}
                              <span className="relative z-10">{child.label}</span>
                            </MotionLink>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          );
        })}
      </nav>

      <div className="flex items-center justify-between border-t border-app-border bg-white p-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <motion.div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-brand"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...springs.bouncy, delay: 0.5 }}
            whileHover={{ scale: motionTokens.scale.pop }}
          >
            {initials(displayName)}
          </motion.div>
          <div className="truncate">
            <div className="truncate text-xs font-semibold leading-tight text-slate-900">{displayName}</div>
            <div className="truncate text-[11px] leading-tight text-slate-500">
              {ROLE_LABELS[user?.defaultRole ?? ''] ?? 'Utilisateur'}
            </div>
          </div>
        </div>
        <motion.button
          type="button"
          onClick={() => void signOut()}
          title="Déconnexion"
          aria-label="Se déconnecter"
          className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
          whileHover={{ x: 2 }}
          whileTap={{ scale: motionTokens.scale.press }}
          transition={springs.snappy}
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </motion.button>
      </div>
    </motion.aside>
  );
}
