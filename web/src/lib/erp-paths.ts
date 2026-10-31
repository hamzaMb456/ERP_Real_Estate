/** Where the ERP lives: the public site owns `/`, the ERP owns everything under `/erp`. */
export const ERP_BASE = '/erp';

/** Prefixes the ERP used before it moved under `/erp`; bookmarks and stored notification links still use them. */
export const LEGACY_PREFIXES: readonly string[] = [
  '/biens',
  '/baux',
  '/contacts',
  '/calendrier',
  '/administration',
  '/finance',
  '/maintenance',
  '/securite',
  '/fournisseurs',
  '/ventes',
  '/rapports',
];

export type LegacyRedirect = { source: string; destination: string; permanent: false };

/** Prefixes an application path with `/erp`; the root maps to `/erp` itself. */
export function erpPath(path: string): string {
  return path === '/' ? ERP_BASE : ERP_BASE + path;
}

/**
 * Redirects from the old ERP paths to their `/erp` form (Next keeps the query string).
 * Temporary on purpose: the old paths may be reused by the public site later. `/` is never redirected.
 */
export function legacyRedirects(): LegacyRedirect[] {
  const sections = LEGACY_PREFIXES.flatMap((prefix) => [
    { source: prefix, destination: ERP_BASE + prefix, permanent: false as const },
    { source: prefix + '/:path*', destination: ERP_BASE + prefix + '/:path*', permanent: false as const },
  ]);
  return [...sections, { source: '/connexion', destination: ERP_BASE + '/connexion', permanent: false }];
}

/** The post-sign-in target from `?next=`: only a path inside the ERP is honoured, anything else goes to the dashboard. */
export function safeNext(next: string | null | undefined): string {
  if (!next || next.startsWith('//')) return ERP_BASE;
  const inside = next === ERP_BASE || next.startsWith(ERP_BASE + '/') || next.startsWith(ERP_BASE + '?') || next.startsWith(ERP_BASE + '#');
  return inside ? next : ERP_BASE;
}
