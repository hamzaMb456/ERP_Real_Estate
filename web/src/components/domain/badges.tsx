'use client';

import { Home, KeyRound, ShoppingCart, type LucideIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';
export type ContactRole = 'owner' | 'renter' | 'buyer';

export const CONTACT_ROLES: {
  value: ContactRole;
  icon: LucideIcon;
  badge: string;
  tile: string;
  avatar: string;
}[] = [
  {
    value: 'owner',
    icon: Home,
    badge: 'bg-accent text-accent-foreground',
    tile: 'bg-accent text-accent-foreground',
    avatar: 'bg-accent text-accent-foreground',
  },
  {
    value: 'renter',
    icon: KeyRound,
    badge: 'bg-info/10 text-info',
    tile: 'bg-info/10 text-info',
    avatar: 'bg-info/10 text-info',
  },
  {
    value: 'buyer',
    icon: ShoppingCart,
    badge: 'bg-warning/15 text-warning',
    tile: 'bg-warning/15 text-warning',
    avatar: 'bg-warning/15 text-warning',
  },
];

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const t = useT();
  const entry = CONTACT_ROLES.find((item) => item.value === role);
  const Icon = entry?.icon;
  return (
    <Badge variant="secondary" className={cn('h-6 gap-1 px-2.5', entry?.badge, className)}>
      {Icon && <Icon data-icon="inline-start" />}
      {t.labels.contactRoles[role]?.label ?? role}
    </Badge>
  );
}

const STATUS: Record<string, { className: string }> = {
  vacant: { className: 'bg-warning/15 text-warning' },
  rented: { className: 'bg-success/12 text-success' },
  for_sale: { className: 'bg-info/10 text-info' },
  sold: { className: 'bg-muted text-muted-foreground' },
  under_maintenance: { className: 'bg-destructive/10 text-destructive' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const t = useT();
  const entry = STATUS[status] ?? { className: 'bg-muted text-muted-foreground' };
  return (
    <Badge variant="secondary" className={cn('h-6 gap-1.5 px-2.5', entry.className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label ?? t.labels.unitStatuses[status] ?? status}
    </Badge>
  );
}
