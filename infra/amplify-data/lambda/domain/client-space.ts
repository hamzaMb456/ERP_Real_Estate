// The signed-in client's own space on the website: saved searches, hidden listings and recently viewed.
// Every row belongs to one client (client_user_id) and is only ever read back for that same client: the
// ops below always filter on caller.userId, never on a value from the request.
import { randomUUID } from 'node:crypto';
import type { Caller } from './auth.ts';
import { getItem, queryAll, table, transact } from './db.ts';
import type { Item, TxItem } from './db.ts';
import { DomainError, fail } from './errors.ts';

const MAX_SAVED_SEARCHES = 30;
const MAX_LABEL = 80;
const MAX_FILTERS = 2000;
const MAX_VIEWS = 50;
const MAX_HIDDEN = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The ops already restrict the role; this keeps the domain honest if one ever forgets. */
function requireClient(caller: Caller): string {
  if (caller.role !== 'user' || !caller.userId) fail('REQUEST_LOGIN_REQUIRED');
  return caller.userId;
}

const rowId = (userId: string, listingId: string): string => `${userId}#${listingId}`;
const nowIso = (): string => new Date().toISOString();

/** A listing must be published for the site before a client can hide or view it. */
async function requireListing(listingId: string): Promise<void> {
  if (!UUID.test(listingId)) fail('listing_not_found');
  if (!(await getItem('PublicListing', { id: listingId }))) fail('listing_not_found');
}

export interface SavedSearchInput {
  label: string;
  filters: string;
}

/** `filters` travels as JSON text; it must at least be a JSON object, bounded, and is re-parsed by the web. */
function cleanFilters(raw: string): string {
  const text = raw.trim();
  if (!text || text.length > MAX_FILTERS) fail('saved_search_invalid');
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) fail('saved_search_invalid');
  } catch {
    fail('saved_search_invalid');
  }
  return text;
}

function cleanLabel(raw: string): string {
  const label = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_LABEL).trim();
  if (!label) fail('saved_search_label_required');
  return label;
}

export async function saveSearch(caller: Caller, input: SavedSearchInput): Promise<Item> {
  const userId = requireClient(caller);
  const label = cleanLabel(input.label);
  const filters = cleanFilters(input.filters);
  const existing = await queryAll('SavedSearch', { index: 'byClient', key: 'client_user_id', value: userId });
  const duplicate = existing.find((row) => row.filters === filters);
  if (duplicate) return duplicate;
  if (existing.length >= MAX_SAVED_SEARCHES) fail('too_many_saved_searches');

  const item: Item = {
    __typename: 'SavedSearch',
    id: randomUUID(),
    client_user_id: userId,
    label,
    filters,
    created_at: nowIso(),
  };
  await transact([{ Put: { TableName: table('SavedSearch'), Item: item, ConditionExpression: 'attribute_not_exists(id)' } }]);
  return item;
}

/** The client's saved searches, newest first. */
export async function savedSearches(caller: Caller): Promise<Item[]> {
  const userId = requireClient(caller);
  const rows = await queryAll('SavedSearch', { index: 'byClient', key: 'client_user_id', value: userId });
  return rows.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

/** Deleting only ever touches a row of the caller: someone else's id is simply "not found". */
export async function deleteSavedSearch(caller: Caller, id: string): Promise<void> {
  const userId = requireClient(caller);
  if (!UUID.test(id)) fail('saved_search_not_found');
  const existing = await getItem('SavedSearch', { id });
  if (!existing || existing.client_user_id !== userId) fail('saved_search_not_found');
  await transact([{ Delete: { TableName: table('SavedSearch'), Key: { id }, ConditionExpression: 'attribute_exists(id)' } }]);
}

export async function hideListing(caller: Caller, listingId: string): Promise<void> {
  const userId = requireClient(caller);
  await requireListing(listingId);
  const hidden = await queryAll('HiddenListing', { index: 'byClient', key: 'client_user_id', value: userId });
  if (!hidden.some((row) => row.listing_id === listingId) && hidden.length >= MAX_HIDDEN) fail('too_many_hidden_listings');
  const item: Item = {
    __typename: 'HiddenListing',
    id: rowId(userId, listingId),
    client_user_id: userId,
    listing_id: listingId,
    created_at: nowIso(),
  };
  // Hiding is idempotent: already hidden (or hidden by a second tab a moment ago) is the state asked for.
  if (hidden.some((row) => row.listing_id === listingId)) return;
  try {
    await transact([{ Put: { TableName: table('HiddenListing'), Item: item, ConditionExpression: 'attribute_not_exists(id)' } }], 'listing_already_hidden');
  } catch (error) {
    if (!(error instanceof DomainError) || error.code !== 'listing_already_hidden') throw error;
  }
}

export async function unhideListing(caller: Caller, listingId: string): Promise<void> {
  const userId = requireClient(caller);
  if (!UUID.test(listingId)) return;
  await transact([{ Delete: { TableName: table('HiddenListing'), Key: { id: rowId(userId, listingId) } } }]);
}

/** The client's hidden listings, newest first. */
export async function hiddenListings(caller: Caller): Promise<Item[]> {
  const userId = requireClient(caller);
  const rows = await queryAll('HiddenListing', { index: 'byClient', key: 'client_user_id', value: userId });
  return rows.sort((a, b) => String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

/**
 * Records that the client opened a listing. One row per client x listing: viewing again moves it to the
 * top instead of adding a duplicate, and the oldest rows beyond MAX_VIEWS are dropped in the same write.
 */
export async function recordView(caller: Caller, listingId: string): Promise<void> {
  const userId = requireClient(caller);
  await requireListing(listingId);
  const views = await queryAll('ListingView', { index: 'byClient', key: 'client_user_id', value: userId });
  const item: Item = {
    __typename: 'ListingView',
    id: rowId(userId, listingId),
    client_user_id: userId,
    listing_id: listingId,
    viewed_at: nowIso(),
  };
  const stale = views
    .filter((row) => row.listing_id !== listingId)
    .sort((a, b) => String(a.viewed_at ?? '').localeCompare(String(b.viewed_at ?? '')))
    .slice(0, Math.max(views.length + (views.some((row) => row.listing_id === listingId) ? 0 : 1) - MAX_VIEWS, 0));
  const items: TxItem[] = [{ Put: { TableName: table('ListingView'), Item: item } }];
  for (const row of stale) items.push({ Delete: { TableName: table('ListingView'), Key: { id: row.id } } });
  await transact(items);
}

/** The client's recently viewed listings, most recent first (at most MAX_VIEWS rows). */
export async function recentlyViewed(caller: Caller): Promise<Item[]> {
  const userId = requireClient(caller);
  const rows = await queryAll('ListingView', { index: 'byClient', key: 'client_user_id', value: userId });
  return rows.sort((a, b) => String(b.viewed_at ?? '').localeCompare(String(a.viewed_at ?? ''))).slice(0, MAX_VIEWS);
}
