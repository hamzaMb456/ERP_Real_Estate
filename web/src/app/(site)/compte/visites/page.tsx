import type { Metadata } from 'next';
import { MyVisitsPage } from '@/components/site/my-visits-page';
import { MESSAGES } from '@/i18n/messages';

/** Personal to the signed-in client: kept out of search engines. */
export const metadata: Metadata = {
  title: MESSAGES.fr.site.myVisits.title,
  robots: { index: false, follow: true },
};

/** /compte/visites: status of the client's own visit requests (redirects to sign-in when signed out). */
export default function MyVisitsRoute() {
  return <MyVisitsPage />;
}
