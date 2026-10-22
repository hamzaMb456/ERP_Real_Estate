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
} from '@/components/icons';

import type { Messages } from '@/i18n/messages';

type NavMessages = Messages['nav'];

/** Keys into the `nav` dictionary: labels live in src/i18n/messages, not here. */
export type NavKey = keyof NavMessages['items'];
export type NavChild = { key: NavKey; href: string };
export type NavItem = { key: NavKey; href: string; icon: LucideIcon; children?: NavChild[] };
export type NavGroup = { key: keyof NavMessages['groups']; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'steering',
    items: [
      { key: 'dashboard', href: '/', icon: LayoutGrid },
      {
        key: 'properties',
        href: '/biens',
        icon: Building2,
        children: [
          { key: 'propertiesAndUnits', href: '/biens' },
          { key: 'propertiesMap', href: '/biens/carte' },
          { key: 'commonAreas', href: '/biens/parties-communes' },
          { key: 'incompleteRecords', href: '/biens/fiches-incompletes' },
          { key: 'archivedProperties', href: '/biens/archives' },
        ],
      },
      { key: 'contacts', href: '/contacts', icon: Users },
      { key: 'calendar', href: '/calendrier', icon: CalendarDays },
    ],
  },
  {
    key: 'management',
    items: [
      {
        key: 'rentersAndLeases',
        href: '/baux',
        icon: FileText,
        children: [
          { key: 'leases', href: '/baux' },
          { key: 'rentalRequests', href: '/baux/demandes' },
        ],
      },
      {
        key: 'finance',
        href: '/finance',
        icon: DollarSign,
        children: [
          { key: 'rentInvoices', href: '/finance' },
          { key: 'payments', href: '/finance/paiements' },
          { key: 'expenses', href: '/finance/depenses' },
        ],
      },
      { key: 'maintenance', href: '/maintenance', icon: Wrench },
      {
        key: 'buildingSecurity',
        href: '/securite',
        icon: Shield,
        children: [
          { key: 'incidents', href: '/securite' },
          { key: 'guardsAndKeys', href: '/securite/gardes-cles' },
        ],
      },
      { key: 'suppliers', href: '/fournisseurs', icon: Package },
      { key: 'sales', href: '/ventes', icon: Tag },
    ],
  },
  {
    key: 'analysis',
    items: [{ key: 'reports', href: '/rapports', icon: ChartColumn }],
  },
  {
    key: 'administration',
    items: [
      {
        key: 'administration',
        href: '/administration',
        icon: Settings,
        children: [
          { key: 'usersAndRoles', href: '/administration' },
          { key: 'auditLog', href: '/administration/audit' },
          { key: 'appearance', href: '/administration/apparence' },
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

const SEGMENT_KEYS: Record<string, keyof NavMessages['crumbs']> = { nouveau: 'new', modifier: 'edit' };

export function buildCrumbs(pathname: string, nav: NavMessages): Crumb[] {
  const section = NAVIGATION.find((item) => item.href === sectionOf(pathname));
  if (!section) return [];
  const sectionLabel = nav.items[section.key];
  if (pathname === '/') return [{ label: sectionLabel }];

  const exact = section.children?.find((child) => child.href === pathname);
  if (exact || pathname === section.href) {
    return exact && exact.href !== section.href
      ? [{ label: sectionLabel, href: section.href }, { label: nav.items[exact.key] }]
      : [{ label: sectionLabel }];
  }

  const rest = pathname.slice(section.href.length).split('/').filter(Boolean);
  const last = rest[rest.length - 1] ?? '';
  return [{ label: sectionLabel, href: section.href }, { label: nav.crumbs[SEGMENT_KEYS[last] ?? 'record'] }];
}
