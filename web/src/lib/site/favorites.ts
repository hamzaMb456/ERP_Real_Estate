// The visitor's favorite listings, kept in the browser (no account on the public site yet). A favorite is a listing id;
// the favorites page loads the listings behind them. Reads and writes never throw: with storage blocked (private
// window) the hearts simply work for the page's lifetime.

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'emerald.favorites.v1';
export const MAX_FAVORITES = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMPTY: string[] = [];

/** Ids stored as JSON, anything unexpected dropped. */
export function parseFavorites(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return EMPTY;
    return [...new Set(value.filter((item): item is string => typeof item === 'string' && UUID.test(item)))].slice(0, MAX_FAVORITES);
  } catch {
    return EMPTY;
  }
}

/** Adds an id at the front, or removes it when it is already there. Never mutates its input. */
export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [id, ...ids].slice(0, MAX_FAVORITES);
}

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function readStorage(): string[] {
  try {
    return parseFavorites(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY;
  }
}

function snapshot(): string[] {
  if (cache === null) cache = readStorage();
  return cache;
}

function publish(next: string[]): void {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage is blocked or full: the favorites stay in memory for this page.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changed the favorites.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    cache = readStorage();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Favorite ids (newest first), whether one id is a favorite, and a toggle. Empty on the server and on first paint. */
export function useFavorites(): { ids: string[]; has: (id: string) => boolean; toggle: (id: string) => void } {
  const ids = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const has = useCallback((id: string) => ids.includes(id), [ids]);
  const toggle = useCallback((id: string) => publish(toggleId(snapshot(), id)), []);
  return { ids, has, toggle };
}

/** Test helper: forgets the in-memory copy so the next read goes to storage again. */
export function resetFavoritesCache(): void {
  cache = null;
  listeners.forEach((listener) => listener());
}
