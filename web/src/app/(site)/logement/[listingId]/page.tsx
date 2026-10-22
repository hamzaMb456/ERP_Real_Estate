import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ListingPageContent } from '@/components/site/listing-page-content';
import { ListingSkeleton } from '@/components/site/listing-skeleton';
import { MESSAGES } from '@/i18n/messages';
import { formatTnd } from '@/lib/format';
import { siteConfig } from '@/lib/site/config';
import { publicImageUrl } from '@/lib/site/image-url';
import { getListing, searchListings, type PublicListing } from '@/lib/site/listings-queries';
import { parseSearchParams } from '@/lib/site/search-params';
import { pickSimilar } from '@/lib/site/similar';

type ListingPageProps = { params: Promise<{ listingId: string }> };

const EXCERPT_LENGTH = 160;
const OG_IMAGE_WIDTH = 1200;

/** First characters of the description on one line, cut at a word. */
function excerptOf(description: string | null): string | null {
  const text = description?.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  if (text.length <= EXCERPT_LENGTH) return text;
  const cut = text.slice(0, EXCERPT_LENGTH);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), EXCERPT_LENGTH / 2)).trimEnd()}…`;
}

/**
 * Metadata of the unit page. The public site is indexed in French only, so the server always uses the French
 * catalog. An unknown or unpublished listing gets noindex (the page itself answers « not found »).
 */
export async function generateMetadata({ params }: ListingPageProps): Promise<Metadata> {
  const { listingId } = await params;
  const t = MESSAGES.fr.site.listing;
  const listing = await getListing(listingId);
  if (!listing) return { title: t.notFoundTitle, robots: { index: false, follow: false } };

  const price = listing.kind === 'rent' ? `${formatTnd(listing.price)} ${MESSAGES.fr.site.listingCard.perMonth}` : formatTnd(listing.price);
  const description = t.meta.description(t.meta[listing.kind], listing.city, price, excerptOf(listing.description));
  const url = `${siteConfig.siteUrl}/logement/${listing.id}`;
  const cover = listing.coverFileId ?? listing.photos?.[0]?.storageFileId ?? null;
  const image = cover ? { url: publicImageUrl(cover, OG_IMAGE_WIDTH), width: OG_IMAGE_WIDTH, alt: listing.title } : null;

  return {
    title: listing.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'fr_TN',
      url,
      siteName: siteConfig.agencyName,
      title: listing.title,
      description,
      ...(image ? { images: [image] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: listing.title,
      description,
      ...(image ? { images: [image.url] } : {}),
    },
  };
}

/** Listings of the same kind and city, close in price. Never fails the page: no city or no backend = no similar. */
async function loadSimilar(listing: PublicListing): Promise<PublicListing[]> {
  const city = listing.city?.trim();
  if (!city) return [];
  try {
    const { items } = await searchListings(listing.kind, parseSearchParams({ ville: city }));
    return pickSimilar(listing, items);
  } catch (error) {
    console.error('[public-listings] similar listings failed', error);
    return [];
  }
}

async function ListingContent({ params }: ListingPageProps) {
  const { listingId } = await params;
  const listing = await getListing(listingId);
  if (!listing) notFound();
  const similar = await loadSimilar(listing);
  return <ListingPageContent listing={listing} similar={similar} />;
}

/** /logement/<id>: the shell is prerendered, the listing streams in behind the skeleton. */
export default function ListingPage({ params }: ListingPageProps) {
  return (
    <Suspense fallback={<ListingSkeleton />}>
      <ListingContent params={params} />
    </Suspense>
  );
}
