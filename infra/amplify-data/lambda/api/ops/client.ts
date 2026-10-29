// The signed-in client's own space on the website: saved searches, hidden listings, recently viewed.
// Every op answers the shape the web asks for (see web/src/lib/site/client-space.ts) and is scoped to
// the caller: no op ever takes a client id from the request.
import {
  deleteSavedSearch,
  hiddenListings,
  hideListing,
  recentlyViewed,
  recordView,
  savedSearches,
  saveSearch,
  unhideListing,
} from '../../domain/client-space.ts';
import type { Op, Vars } from '../registry.ts';
import { CLIENT, mutation, query } from '../registry.ts';

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

export const clientOps: Record<string, Op> = {
  MySavedSearches: query(CLIENT, async (caller) => ({
    saved_searches: (await savedSearches(caller)).map((row) => ({
      id: row.id, label: row.label, filters: row.filters, created_at: row.created_at,
    })),
  })),
  SaveSearch: mutation(CLIENT, async (caller, v: Vars) => {
    const row = await saveSearch(caller, { label: text(v.label), filters: text(v.filters) });
    return { insert_saved_searches_one: { id: row.id, label: row.label, filters: row.filters, created_at: row.created_at } };
  }),
  DeleteSavedSearch: mutation(CLIENT, async (caller, v: Vars) => {
    await deleteSavedSearch(caller, text(v.id));
    return { delete_saved_searches: { affected_rows: 1 } };
  }),

  MyHiddenListings: query(CLIENT, async (caller) => ({
    hidden_listings: (await hiddenListings(caller)).map((row) => ({
      listing_id: row.listing_id, created_at: row.created_at,
    })),
  })),
  HideListing: mutation(CLIENT, async (caller, v: Vars) => {
    await hideListing(caller, text(v.listing));
    return { hide_listing: { ok: true } };
  }),
  UnhideListing: mutation(CLIENT, async (caller, v: Vars) => {
    await unhideListing(caller, text(v.listing));
    return { unhide_listing: { ok: true } };
  }),

  MyRecentlyViewed: query(CLIENT, async (caller) => ({
    recently_viewed: (await recentlyViewed(caller)).map((row) => ({
      listing_id: row.listing_id, viewed_at: row.viewed_at,
    })),
  })),
  RecordListingView: mutation(CLIENT, async (caller, v: Vars) => {
    await recordView(caller, text(v.listing));
    return { record_listing_view: { ok: true } };
  }),
};
