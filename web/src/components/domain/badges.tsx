import { Home, KeyRound, ShoppingCart, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type ContactRole = 'owner' | 'renter' | 'buyer';

export const CONTACT_ROLES: {
  value: ContactRole;
  label: string;
  description: string;
  icon: LucideIcon;
  badge: string;
  tile: string;
  avatar: string;
}[] = [
  {
    value: 'owner',
    label: 'Propriétaire',
    description: 'Possède un bien ou une unité que nous gérons.',
    icon: Home,
    badge: 'bg-accent text-accent-foreground',
    tile: 'bg-accent text-accent-foreground',
    avatar: 'bg-accent text-accent-foreground',
  },
  {
    value: 'renter',
    label: 'Locataire',
    description: 'Loue une unité avec un bail.',
    icon: KeyRound,
    badge: 'bg-info/10 text-info',
    tile: 'bg-info/10 text-info',
    avatar: 'bg-info/10 text-info',
  },
  {
    value: 'buyer',
    label: 'Acquéreur',
    description: 'Achète une unité ou a fait une offre.',
    icon: ShoppingCart,
    badge: 'bg-warning/15 text-warning',
    tile: 'bg-warning/15 text-warning',
    avatar: 'bg-warning/15 text-warning',
  },
];

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const entry = CONTACT_ROLES.find((item) => item.value === role);
  const Icon = entry?.icon;
  return (
    <Badge variant="secondary" className={cn('h-6 gap-1 px-2.5', entry?.badge, className)}>
      {Icon && <Icon data-icon="inline-start" />}
      {entry?.label ?? role}
    </Badge>
  );
}

const STATUS: Record<string, { label: string; className: string }> = {
  vacant: { label: 'Disponible', className: 'bg-warning/15 text-warning' },
  rented: { label: 'Loué', className: 'bg-success/12 text-success' },
  for_sale: { label: 'À vendre', className: 'bg-info/10 text-info' },
  sold: { label: 'Vendu', className: 'bg-muted text-muted-foreground' },
  under_maintenance: { label: 'En travaux', className: 'bg-destructive/10 text-destructive' },
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const entry = STATUS[status] ?? { label: status, className: 'bg-muted text-muted-foreground' };
  return (
    <Badge variant="secondary" className={cn('h-6 gap-1.5 px-2.5', entry.className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label ?? entry.label}
    </Badge>
  );
}
