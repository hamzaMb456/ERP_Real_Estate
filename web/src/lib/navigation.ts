import {
  CalendarDays,
  ChartColumn,
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
export type NavItem = { label: string; href: string; icon: LucideIcon; children?: NavChild[] };
export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Pilotage',
    items: [
      { label: 'Tableau de bord', href: '/', icon: LayoutGrid },
      {
        label: 'Biens',
        href: '/biens',
        icon: Building2,
        children: [
          { label: 'Biens et unités', href: '/biens' },
          { label: 'Carte des biens', href: '/biens/carte' },
          { label: 'Parties communes', href: '/biens/parties-communes' },
          { label: 'Fiches incomplètes', href: '/biens/fiches-incompletes' },
          { label: 'Biens archivés', href: '/biens/archives' },
        ],
      },
      { label: 'Contacts', href: '/contacts', icon: Users },
      { label: 'Calendrier', href: '/calendrier', icon: CalendarDays },
    ],
  },
  {
    label: 'Gestion',
    items: [
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
    ],
  },
  {
    label: 'Analyse',
    items: [{ label: 'Rapports', href: '/rapports', icon: ChartColumn }],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Administration',
        href: '/administration',
        icon: Settings,
        children: [
          { label: 'Utilisateurs et rôles', href: '/administration' },
          { label: "Journal d'audit", href: '/administration/audit' },
        ],
      },
    ],
  },
];

export const NAVIGATION: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function sectionOf(pathname: string): string {
  if (pathname === '/') return '/';
  return '/' + (pathname.split('/')[1] ?? '');
}

export type Crumb = { label: string; href?: string };

const SEGMENT_LABELS: Record<string, string> = { nouveau: 'Nouveau', modifier: 'Modifier' };

export function buildCrumbs(pathname: string): Crumb[] {
  const section = NAVIGATION.find((item) => item.href === sectionOf(pathname));
  if (!section) return [];
  if (pathname === '/') return [{ label: section.label }];

  const exact = section.children?.find((child) => child.href === pathname);
  if (exact || pathname === section.href) {
    return [{ label: section.label, href: section.href }, ...(exact && exact.href !== section.href ? [{ label: exact.label }] : [])].map(
      (crumb, index, all) => (index === all.length - 1 ? { label: crumb.label } : crumb),
    );
  }

  const rest = pathname.slice(section.href.length).split('/').filter(Boolean);
  const last = rest[rest.length - 1] ?? '';
  const label = SEGMENT_LABELS[last] ?? 'Fiche';
  return [{ label: section.label, href: section.href }, { label }];
}
