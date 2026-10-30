import type { MetadataRoute } from 'next';
import { getAgencies } from '@/lib/site/agencies';
import { siteConfig } from '@/lib/site/config';

/** The public pages search engines should index: the home page, the search pages, the agencies directory and each agency. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.siteUrl.replace(/\/$/, '');
  const agencies = await getAgencies();
  return [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/louer`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/acheter`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/agences`, changeFrequency: 'monthly', priority: 0.7 },
    ...agencies.map((agency) => ({ url: `${base}/agences/${agency.slug}`, changeFrequency: 'monthly' as const, priority: 0.7 })),
  ];
}
