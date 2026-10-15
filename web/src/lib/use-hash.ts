'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Tabs and dialogs follow the URL hash so other pages can link to the exact place to fix
// (for example /biens/<id>/unites/<unitId>#proprietaires). Reading it through
// useSyncExternalStore keeps server rendering (empty hash) and the browser in sync.

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

const readHash = () => decodeURIComponent(window.location.hash.slice(1));
const serverHash = () => '';

export function useHash(): [string, (value: string) => void] {
  const hash = useSyncExternalStore(subscribe, readHash, serverHash);
  const setHash = useCallback((value: string) => {
    const url = window.location.pathname + window.location.search + (value ? '#' + value : '');
    window.history.replaceState(window.history.state, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }, []);
  return [hash, setHash];
}

export function useHashTab<T extends string>(tabs: readonly T[], fallback: T): [T, (tab: T) => void] {
  const [hash, setHash] = useHash();
  const current = (tabs as readonly string[]).includes(hash) ? (hash as T) : fallback;
  return [current, setHash];
}
