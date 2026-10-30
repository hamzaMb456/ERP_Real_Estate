'use client';

import { useSyncExternalStore } from 'react';

// navigator.onLine turns false only when the device has no network at all. A server that is down while the
// device is online is not reported here; those requests fail on their own.

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const readOnline = () => navigator.onLine;
// Server rendering assumes online, so the notice never flashes on a page that is in fact connected.
const serverOnline = () => true;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, readOnline, serverOnline);
}
