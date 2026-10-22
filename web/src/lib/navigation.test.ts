import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/i18n/messages';
import { NAV_GROUPS, buildCrumbs, sectionOf } from '@/lib/navigation';

const nav = MESSAGES.fr.nav;

describe('sectionOf', () => {
  it('names the section a path belongs to', () => {
    expect(sectionOf('/erp/biens/1/unites/2')).toBe('/erp/biens');
    expect(sectionOf('/erp/baux')).toBe('/erp/baux');
  });

  it('maps the dashboard to /erp', () => {
    expect(sectionOf('/erp')).toBe('/erp');
  });
});

describe('NAV_GROUPS', () => {
  it('keeps every link under /erp', () => {
    const hrefs = NAV_GROUPS.flatMap((group) =>
      group.items.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]),
    );
    expect(hrefs.every((href) => href === '/erp' || href.startsWith('/erp/'))).toBe(true);
  });
});

describe('buildCrumbs', () => {
  it('shows only the dashboard on /erp', () => {
    expect(buildCrumbs('/erp', nav)).toEqual([{ label: nav.items.dashboard }]);
  });

  it('links the section then names a child page', () => {
    expect(buildCrumbs('/erp/baux/demandes', nav)).toEqual([
      { label: nav.items.rentersAndLeases, href: '/erp/baux' },
      { label: nav.items.rentalRequests },
    ]);
  });

  it('labels a record page by its section', () => {
    expect(buildCrumbs('/erp/biens/1', nav)).toEqual([
      { label: nav.items.properties, href: '/erp/biens' },
      { label: nav.crumbs.record },
    ]);
  });

  it('finds nothing outside the ERP', () => {
    expect(buildCrumbs('/louer/1', nav)).toEqual([]);
  });
});
