import type { Metadata } from 'next';
import { ClientDashboard } from '@/components/site/client-dashboard';
import { MESSAGES } from '@/i18n/messages';
import { getPublishedCities } from '@/lib/site/listings-queries';

/** Personal to the signed-in client: kept out of search engines. */
export const metadata: Metadata = {
  title: MESSAGES.fr.site.dashboard.metaTitle,
  robots: { index: false, follow: true },
};

/** /compte: client dashboard (greeting, 4 counters, save search, hidden listings, recently viewed). */
export default async function CompteRoute() {
  const cities = await getPublishedCities();
  return <ClientDashboard cities={cities} />;
}
