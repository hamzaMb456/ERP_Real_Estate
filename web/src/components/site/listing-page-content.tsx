'use client';

import type { PublicListing } from '@/lib/site/listings-queries';
import { ListingContactCard } from './listing-contact-card';
import {
  ListingAmenities,
  ListingConditions,
  ListingDescription,
  ListingDocuments,
  ListingLocation,
} from './listing-details';
import { ListingGallery } from './listing-gallery';
import { ListingBreadcrumb, ListingHeader } from './listing-header';
import { ListingSimilar } from './listing-similar';

/**
 * Body of the unit page: breadcrumb, gallery, then the header and the details on the left with the sticky contact
 * card on the right (on phones the card follows the header, before the details), then similar listings.
 * The data is read on the server; this part only displays it.
 */
export function ListingPageContent({ listing, similar }: { listing: PublicListing; similar: PublicListing[] }) {
  return (
    <>
      <ListingBreadcrumb listing={listing} />
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <ListingGallery listing={listing} />
        <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-12 lg:items-start">
          <div className="min-w-0 lg:col-span-8">
            <ListingHeader listing={listing} />
          </div>
          <div className="min-w-0 lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1 lg:self-stretch">
            <ListingContactCard listing={listing} />
          </div>
          <div className="min-w-0 space-y-8 lg:col-span-8">
            <ListingDescription listing={listing} />
            <ListingAmenities listing={listing} />
            <ListingLocation listing={listing} />
            <ListingConditions listing={listing} />
            <ListingDocuments listing={listing} />
          </div>
        </div>
        <ListingSimilar listing={listing} similar={similar} />
      </div>
    </>
  );
}
