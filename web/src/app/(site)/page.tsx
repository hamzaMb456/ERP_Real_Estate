import type { Metadata } from 'next';
import { HomeHero } from '@/components/site/home-hero';
import { HomeListingsSection, HomeStats, HowItWorks, SandBand } from '@/components/site/home-sections';
import { MESSAGES } from '@/i18n/messages';
import { countPublished, getLatestListings, getPublishedCities } from '@/lib/site/listings-queries';

const LATEST_COUNT = 3;

// The public site is indexed in French only (see the layout): the metadata always uses the French catalog.
const { meta } = MESSAGES.fr.site.home;
export const metadata: Metadata = {
  title: { absolute: meta.title },
  description: meta.description,
};

/**
 * Home page. The four public queries are cached and never throw (an unreachable or not yet set up backend gives
 * empty results), so the page prerenders either way and shows its empty states.
 */
export default async function HomePage() {
  const [rent, sale, counts, cities] = await Promise.all([
    getLatestListings('rent', LATEST_COUNT),
    getLatestListings('sale', LATEST_COUNT),
    countPublished(),
    getPublishedCities(),
  ]);

  // The newest listings' cover photos play behind the search card.
  const heroPhotos = [...rent, ...sale].flatMap((listing) => (listing.coverFileId ? [listing.coverFileId] : []));

  return (
    <>
      <HomeHero cities={cities} photos={heroPhotos} />
      <HomeStats total={counts.total} cities={counts.cities} />
      <HomeListingsSection kind="rent" listings={rent} />
      <HomeListingsSection kind="sale" listings={sale} />
      <HowItWorks />
      <SandBand />
    </>
  );
}
