import type { Metadata } from 'next';
import { ClientProfile } from '@/components/site/client-profile';
import { MESSAGES } from '@/i18n/messages';

/** Personal to the signed-in client: kept out of search engines. */
export const metadata: Metadata = {
  title: MESSAGES.fr.site.profile.metaTitle,
  robots: { index: false, follow: true },
};

/** /compte/profil: client profile details and password reset. */
export default function ProfilRoute() {
  return <ClientProfile />;
}
