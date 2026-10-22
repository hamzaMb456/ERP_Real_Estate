import { describe, expect, it } from 'vitest';
import { ERP_BASE, LEGACY_PREFIXES, erpPath, legacyRedirects, safeNext } from '@/lib/erp-paths';

describe('erpPath', () => {
  it('prefixes a path with /erp', () => {
    expect(ERP_BASE).toBe('/erp');
    expect(erpPath('/biens/1')).toBe('/erp/biens/1');
  });

  it('maps the root to /erp itself', () => {
    expect(erpPath('/')).toBe('/erp');
  });
});

describe('legacyRedirects', () => {
  const redirects = legacyRedirects();

  it('sends an old section and everything below it to /erp, temporarily', () => {
    expect(redirects).toContainEqual({ source: '/baux/:path*', destination: '/erp/baux/:path*', permanent: false });
    expect(redirects).toContainEqual({ source: '/baux', destination: '/erp/baux', permanent: false });
  });

  it('sends the old sign-in page to the new one', () => {
    expect(redirects).toContainEqual({ source: '/connexion', destination: '/erp/connexion', permanent: false });
  });

  it('covers every legacy prefix exactly twice, plus the sign-in page', () => {
    expect(redirects).toHaveLength(LEGACY_PREFIXES.length * 2 + 1);
  });

  it('never redirects the public home', () => {
    expect(redirects.some((entry) => entry.source === '/')).toBe(false);
  });
});

describe('safeNext', () => {
  it('keeps a target inside the ERP', () => {
    expect(safeNext('/erp/biens/123')).toBe('/erp/biens/123');
    expect(safeNext('/erp')).toBe('/erp');
  });

  it('falls back to the dashboard for anything else', () => {
    expect(safeNext('https://evil.tld')).toBe('/erp');
    expect(safeNext('//evil.tld')).toBe('/erp');
    expect(safeNext('/louer')).toBe('/erp');
    expect(safeNext('/erpish')).toBe('/erp');
    expect(safeNext(null)).toBe('/erp');
    expect(safeNext(undefined)).toBe('/erp');
  });
});
