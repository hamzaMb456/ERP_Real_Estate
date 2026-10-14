import {
  BarChart3,
  Building2,
  FileText,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Tag,
  Truck,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type NavChild = { label: string; href: string };
export type NavItem = { label: string; href: string; icon: LucideIcon; children?: NavChild[] };

export const NAVIGATION: NavItem[] = [
  { label: 'Tableau de bord', href: '/', icon: LayoutDashboard },
  {
    label: 'Biens',
    href: '/biens',
    icon: Building2,
    children: [
      { label: 'Biens et unités', href: '/biens' },
      { label: 'Carte des biens', href: '/biens/carte' },
      { label: 'Parties communes', href: '/biens/parties-communes' },
      { label: 'Biens archivés', href: '/biens/archives' },
    ],
  },
  { label: 'Contacts', href: '/contacts', icon: Users },
  {
    label: 'Locataires et baux',
    href: '/baux',
    icon: FileText,
    children: [
      { label: 'Baux', href: '/baux' },
      { label: 'Demandes de location', href: '/baux/demandes' },
    ],
  },
  {
    label: 'Finance',
    href: '/finance',
    icon: Wallet,
    children: [
      { label: 'Factures de loyer', href: '/finance' },
      { label: 'Paiements', href: '/finance/paiements' },
      { label: 'Dépenses', href: '/finance/depenses' },
    ],
  },
  { label: 'Maintenance', href: '/maintenance', icon: Wrench },
  {
    label: 'Sécurité des immeubles',
    href: '/securite',
    icon: ShieldCheck,
    children: [
      { label: 'Incidents', href: '/securite' },
      { label: 'Gardes et clés', href: '/securite/gardes-cles' },
    ],
  },
  { label: 'Fournisseurs', href: '/fournisseurs', icon: Truck },
  { label: 'Ventes', href: '/ventes', icon: Tag },
  { label: 'Rapports', href: '/rapports', icon: BarChart3 },
  {
    label: 'Administration',
    href: '/administration',
    icon: Settings,
    children: [
      { label: 'Utilisateurs et rôles', href: '/administration' },
      { label: "Journal d'audit", href: '/administration/audit' },
    ],
  },
];

export function findTrail(pathname: string): string[] {
  for (const item of NAVIGATION) {
    const child = item.children?.find((c) => c.href === pathname);
    if (child) return [item.label, child.label];
    if (item.href === pathname) return [item.label];
  }
  return [];
}
