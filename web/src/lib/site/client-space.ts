'use client';

// The signed-in client's own space, read from the server: saved searches, hidden listings and recently
// viewed listings. One row per client in DynamoDB (see lambda/domain/client-space.ts), so the dashboard
// follows the client across devices, unlike the favorites which stay in this browser.
//
// Every read and write is a named GraphQL op. Failures never throw at the caller: a hidden-listing
// toggle that fails simply comes back to its previous state.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { graphql } from '@/lib/graphql';
import { parseSearchParams, toQueryString, type RawSearchParams, type SearchFilters, type SearchMode } from './search-params';

const MY_SAVED = `query MySavedSearches { saved_searches { id label filters created_at } }`;
const SAVE = `mutation SaveSearch($label: String!, $filters: String!) {
  insert_saved_searches_one(object: { label: $label, filters: $filters }) { id label filters created_at }
}`;
const DELETE_SAVED = `mutation DeleteSavedSearch($id: uuid!) { delete_saved_searches(where: { id: { _eq: $id } }) { affected_rows } }`;

const MY_HIDDEN = `query MyHiddenListings { hidden_listings { listing_id created_at } }`;
const HIDE = `mutation HideListing($listing: uuid!) { hide_listing(args: { p_listing_id: $listing }) { ok } }`;
const UNHIDE = `mutation UnhideListing($listing: uuid!) { unhide_listing(args: { p_listing_id: $listing }) { ok } }`;

const MY_VIEWED = `query MyRecentlyViewed { recently_viewed { listing_id viewed_at } }`;
const RECORD_VIEW = `mutation RecordListingView($listing: uuid!) { record_listing_view(args: { p_listing_id: $listing }) { ok } }`;

// ---------------------------------------------------------------- saved searches

export type SavedSearch = {
  id: string;
  label: string;
  /** Search page to rerun and the filters, already parsed back into the URL grammar. */
  mode: SearchMode;
  filters: SearchFilters;
  createdAt: string | null;
};

type SavedRow = { id: string; label: string; filters: string; created_at: string | null };

/**
 * The stored form of a search: the page (louer / acheter) and the query string of the filters. The
 * query string is the same grammar as the URL, so decoding goes through the hostile-input parser.
 */
export function encodeSearch(mode: SearchMode, filters: SearchFilters): string {
  return JSON.stringify({ mode, query: toQueryString(filters) });
}

/** Decodes a stored search, or null when the row was tampered with (it is then left out, not shown broken). */
export function decodeSearch(raw: string): { mode: SearchMode; filters: SearchFilters } | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { mode, query } = value as { mode?: unknown; query?: unknown };
    if ((mode !== 'rent' && mode !== 'sale') || typeof query !== 'string') return null;
    const params: RawSearchParams = {};
    for (const [key, entry] of new URLSearchParams(query)) {
      const current = params[key];
      params[key] = current === undefined ? entry : Array.isArray(current) ? [...current, entry] : [current, entry];
    }
    return { mode, filters: parseSearchParams(params) };
  } catch {
    return null;
  }
}

export function toSavedSearch(row: SavedRow): SavedSearch | null {
  const decoded = decodeSearch(row.filters);
  if (!decoded) return null;
  return { id: row.id, label: row.label, mode: decoded.mode, filters: decoded.filters, createdAt: row.created_at };
}

type SavedState = { status: 'idle' | 'loading' | 'ready'; items: SavedSearch[] };
const NO_SAVED: SavedState = { status: 'idle', items: [] };

/** The client's saved searches, newest first, plus save/delete. Nothing is read while signed out. */
export function useSavedSearches(enabled: boolean) {
  const [state, setState] = useState<SavedState>(NO_SAVED);

  useEffect(() => {
    if (!enabled) {
      setState(NO_SAVED);
      return;
    }
    let active = true;
    setState((previous) => ({ status: previous.status === 'ready' ? 'ready' : 'loading', items: previous.items }));
    void graphql<{ saved_searches: SavedRow[] }>(MY_SAVED)
      .then((data) => {
        if (!active) return;
        const items = data.saved_searches.flatMap((row) => toSavedSearch(row) ?? []);
        setState({ status: 'ready', items });
      })
      .catch(() => active && setState({ status: 'ready', items: [] }));
    return () => {
      active = false;
    };
  }, [enabled]);

  /** Returns the saved row, or null when the server refused (the dashboard words the failure). */
  const save = useCallback(async (label: string, mode: SearchMode, filters: SearchFilters): Promise<SavedSearch | null> => {
    try {
      const data = await graphql<{ insert_saved_searches_one: SavedRow }>(SAVE, { label, filters: encodeSearch(mode, filters) });
      const saved = toSavedSearch(data.insert_saved_searches_one);
      if (saved) setState((previous) => ({ status: 'ready', items: [saved, ...previous.items.filter((item) => item.id !== saved.id)] }));
      return saved;
    } catch {
      return null;
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    const previous = state.items;
    setState({ status: 'ready', items: previous.filter((item) => item.id !== id) });
    try {
      await graphql(DELETE_SAVED, { id });
      return true;
    } catch {
      setState({ status: 'ready', items: previous });
      return false;
    }
  }, [state.items]);

  return { ...state, save, remove };
}

// ---------------------------------------------------------------- hidden listings

type HiddenState = { status: 'idle' | 'loading' | 'ready'; ids: string[] };
const NO_HIDDEN: HiddenState = { status: 'idle', ids: [] };
const EMPTY_IDS: string[] = [];

// One store for the whole page: the card button, the search grid and the dashboard all read the same list,
// so hiding a listing in the grid updates the dashboard counters without a reload.
let hiddenState: HiddenState = NO_HIDDEN;
let hiddenLoading = false;
const hiddenListeners = new Set<() => void>();

function publishHidden(next: HiddenState): void {
  hiddenState = next;
  hiddenListeners.forEach((listener) => listener());
}

function subscribeHidden(listener: () => void): () => void {
  hiddenListeners.add(listener);
  return () => {
    hiddenListeners.delete(listener);
  };
}

async function loadHidden(): Promise<void> {
  if (hiddenLoading) return;
  hiddenLoading = true;
  publishHidden({ status: 'loading', ids: hiddenState.ids });
  try {
    const data = await graphql<{ hidden_listings: { listing_id: string }[] }>(MY_HIDDEN);
    publishHidden({ status: 'ready', ids: data.hidden_listings.map((row) => row.listing_id) });
  } catch {
    publishHidden({ status: 'ready', ids: hiddenState.ids });
  } finally {
    hiddenLoading = false;
  }
}

/** Forgets the list (sign-out, tests): the next signed-in page loads it again. */
export function resetHiddenListings(): void {
  hiddenLoading = false;
  publishHidden(NO_HIDDEN);
}

/**
 * The listings this client hid, and the toggle. `enabled` is the session: signed out, the list is empty
 * and nothing is requested.
 */
export function useHiddenListings(enabled: boolean): {
  ready: boolean;
  ids: string[];
  has: (id: string) => boolean;
  hide: (id: string) => Promise<void>;
  unhide: (id: string) => Promise<void>;
} {
  const state = useSyncExternalStore(subscribeHidden, () => hiddenState, () => NO_HIDDEN);

  useEffect(() => {
    if (!enabled) {
      if (hiddenState.status !== 'idle') resetHiddenListings();
      return;
    }
    if (hiddenState.status === 'idle') void loadHidden();
  }, [enabled]);

  const hide = useCallback(async (id: string) => {
    const previous = hiddenState.ids;
    publishHidden({ status: 'ready', ids: [id, ...previous.filter((entry) => entry !== id)] });
    try {
      await graphql(HIDE, { listing: id });
    } catch {
      publishHidden({ status: 'ready', ids: previous });
    }
  }, []);

  const unhide = useCallback(async (id: string) => {
    const previous = hiddenState.ids;
    publishHidden({ status: 'ready', ids: previous.filter((entry) => entry !== id) });
    try {
      await graphql(UNHIDE, { listing: id });
    } catch {
      publishHidden({ status: 'ready', ids: previous });
    }
  }, []);

  return {
    ready: state.status === 'ready',
    ids: state.ids,
    has: (id: string) => state.ids.includes(id),
    hide,
    unhide,
  };
}

// ---------------------------------------------------------------- recently viewed

/** Records that the signed-in client opened a listing. Best effort: a failed view never disturbs the page. */
export async function recordListingView(listingId: string): Promise<void> {
  try {
    await graphql(RECORD_VIEW, { listing: listingId });
  } catch {
    // A view is a nicety, not a feature the page depends on.
  }
}

type ViewedState = { status: 'idle' | 'loading' | 'ready'; ids: string[] };
const NO_VIEWED: ViewedState = { status: 'idle', ids: EMPTY_IDS };

/** The client's recently viewed listing ids, most recent first (the dashboard loads the cards behind them). */
export function useRecentlyViewed(enabled: boolean): { status: ViewedState['status']; ids: string[] } {
  const [state, setState] = useState<ViewedState>(NO_VIEWED);

  useEffect(() => {
    if (!enabled) {
      setState(NO_VIEWED);
      return;
    }
    let active = true;
    setState((previous) => ({ status: previous.status === 'ready' ? 'ready' : 'loading', ids: previous.ids }));
    void graphql<{ recently_viewed: { listing_id: string }[] }>(MY_VIEWED)
      .then((data) => {
        if (!active) return;
        setState({ status: 'ready', ids: data.recently_viewed.map((row) => row.listing_id) });
      })
      .catch(() => active && setState({ status: 'ready', ids: EMPTY_IDS }));
    return () => {
      active = false;
    };
  }, [enabled]);

  return { status: state.status, ids: state.ids };
}
