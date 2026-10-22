// Public front office settings. Every value is public (NEXT_PUBLIC_*): they reach the browser, so no secret belongs here.
// Each variable is read by its literal name so Next.js can inline it into client bundles.

export const siteConfig = {
  /** The one organization the public site serves. Empty = not configured: public queries answer with empty results. */
  orgId: process.env.NEXT_PUBLIC_AGENCY_ORG_ID || '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  agencyName: 'Emerald Immobilier' as const,
  phone: process.env.NEXT_PUBLIC_AGENCY_PHONE || '+216 71 000 000',
  email: process.env.NEXT_PUBLIC_AGENCY_EMAIL || 'contact@emerald-immobilier.tn',
  address: process.env.NEXT_PUBLIC_AGENCY_ADDRESS || 'Rue du Lac Biwa, Les Berges du Lac, Tunis',
};
