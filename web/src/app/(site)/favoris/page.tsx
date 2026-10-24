import type { Metadata } from 'next';
import { FavoritesPage } from '@/components/site/favorites-page';
import { MESSAGES } from '@/i18n/messages';

/** Personal to the visitor's device: kept out of search engines. */
export const metadata: Metadata = {
  title: MESSAGES.fr.site.favourites.title,
  robots: { index: false, follow: true },
};

/** /favoris: the listings the visitor hearted (read from the browser on the client). */
export default function FavoritesRoute() {
  return <FavoritesPage />;
}
