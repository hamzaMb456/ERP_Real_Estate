import type { Metadata } from 'next';
import { MyRentalRequestsPage } from '@/components/site/my-rental-requests-page';
import { MESSAGES } from '@/i18n/messages';

/** Personal to the signed-in client: kept out of search engines. */
export const metadata: Metadata = {
  title: MESSAGES.fr.site.myRentals.title,
  robots: { index: false, follow: true },
};

/** /compte/demandes: status of the client's own rental requests (redirects to sign-in when signed out). */
export default function MyRentalRequestsRoute() {
  return <MyRentalRequestsPage />;
}
