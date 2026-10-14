import {
  BarChart3,
  Building2,
  DollarSign,
  FileText,
  LayoutGrid,
  Package,
  Settings,
  Shield,
  Tag,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

export type NavChild = { label: string; href: string };
export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: NavChild[];
  separated?: boolean;
};

export const NAVIGATION: NavItem[] = [
  { label: 'Tableau de bord', href: '/', icon: LayoutGrid },
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
    icon: DollarSign,
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
    icon: Shield,
    children: [
      { label: 'Incidents', href: '/securite' },
      { label: 'Gardes et clés', href: '/securite/gardes-cles' },
    ],
  },
  { label: 'Fournisseurs', href: '/fournisseurs', icon: Package },
  { label: 'Ventes', href: '/ventes', icon: Tag },
  { label: 'Rapports', href: '/rapports', icon: BarChart3 },
  {
    label: 'Administration',
    href: '/administration',
    icon: Settings,
    separated: true,
    children: [
      { label: 'Utilisateurs et rôles', href: '/administration' },
      { label: "Journal d'audit", href: '/administration/audit' },
    ],
  },
];

export const SEARCH_PLACEHOLDERS: Record<string, string> = {
  '/': 'Rechercher un bien, un locataire…',
  '/biens': 'Rechercher un bien ou une unité…',
  '/contacts': 'Rechercher un contact...',
};

export function sectionOf(pathname: string): string {
  if (pathname === '/') return '/';
  return '/' + (pathname.split('/')[1] ?? '');
}

export function findTrail(pathname: string): string[] {
  for (const item of NAVIGATION) {
    const child = item.children?.find((c) => c.href === pathname);
    if (child) return [child.label];
    if (item.href === pathname) return [item.label];
  }
  const section = NAVIGATION.find((item) => item.href === sectionOf(pathname));
  return section ? [section.label] : [];
}
