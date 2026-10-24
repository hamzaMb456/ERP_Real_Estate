import {
  CalendarClock,
  CalendarDays,
  ChartColumn,
  Building2,
  DollarSign,
  DoorOpen,
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
import { ERP_BASE } from '@/lib/erp-paths';

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
      { key: 'dashboard', href: '/erp', icon: LayoutGrid },
      {
        key: 'properties',
        href: '/erp/biens',
        icon: Building2,
        children: [
          { key: 'propertiesAndUnits', href: '/erp/biens' },
          { key: 'propertiesMap', href: '/erp/biens/carte' },
          { key: 'commonAreas', href: '/erp/biens/parties-communes' },
          { key: 'incompleteRecords', href: '/erp/biens/fiches-incompletes' },
          { key: 'archivedProperties', href: '/erp/biens/archives' },
        ],
      },
      { key: 'units', href: '/erp/unites', icon: DoorOpen },
      { key: 'contacts', href: '/erp/contacts', icon: Users },
      { key: 'calendar', href: '/erp/calendrier', icon: CalendarDays },
      { key: 'visits', href: '/erp/visites', icon: CalendarClock },
    ],
  },
  {
    key: 'management',
    items: [
      {
        key: 'rentersAndLeases',
        href: '/erp/baux',
        icon: FileText,
        children: [
          { key: 'leases', href: '/erp/baux' },
          { key: 'rentalRequests', href: '/erp/baux/demandes' },
        ],
      },
      {
        key: 'finance',
        href: '/erp/finance',
        icon: DollarSign,
        children: [
          { key: 'rentInvoices', href: '/erp/finance' },
          { key: 'payments', href: '/erp/finance/paiements' },
          { key: 'expenses', href: '/erp/finance/depenses' },
        ],
      },
      { key: 'maintenance', href: '/erp/maintenance', icon: Wrench },
      {
        key: 'buildingSecurity',
        href: '/erp/securite',
        icon: Shield,
        children: [
          { key: 'incidents', href: '/erp/securite' },
          { key: 'guardsAndKeys', href: '/erp/securite/gardes-cles' },
        ],
      },
      { key: 'suppliers', href: '/erp/fournisseurs', icon: Package },
      { key: 'sales', href: '/erp/ventes', icon: Tag },
    ],
  },
  {
    key: 'analysis',
    items: [{ key: 'reports', href: '/erp/rapports', icon: ChartColumn }],
  },
  {
    key: 'administration',
    items: [
      {
        key: 'administration',
        href: '/erp/administration',
        icon: Settings,
        children: [
          { key: 'usersAndRoles', href: '/erp/administration' },
          { key: 'auditLog', href: '/erp/administration/audit' },
          { key: 'appearance', href: '/erp/administration/apparence' },
          { key: 'visitSettings', href: '/erp/administration/visites' },
        ],
      },
    ],
  },
];

export const NAVIGATION: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export function sectionOf(pathname: string): string {
  if (pathname === ERP_BASE) return ERP_BASE;
  const segments = pathname.split('/');
  if (segments[1] === 'erp') return segments[2] ? ERP_BASE + '/' + segments[2] : ERP_BASE;
  return '/' + (segments[1] ?? '');
}

export type Crumb = { label: string; href?: string };

const SEGMENT_KEYS: Record<string, keyof NavMessages['crumbs']> = { nouveau: 'new', modifier: 'edit' };

export function buildCrumbs(pathname: string, nav: NavMessages): Crumb[] {
  const section = NAVIGATION.find((item) => item.href === sectionOf(pathname));
  if (!section) return [];
  const sectionLabel = nav.items[section.key];
  if (pathname === ERP_BASE) return [{ label: sectionLabel }];

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
