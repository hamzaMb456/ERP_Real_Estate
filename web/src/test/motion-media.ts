/** Makes window.matchMedia answer the two prefers-reduced-motion queries the app uses. */
export function stubMotionPreference(preference: 'full' | 'reduced') {
  window.matchMedia = (query: string) =>
    ({
      matches: query.includes(': reduce)') ? preference === 'reduced' : query.includes('no-preference') ? preference === 'full' : false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
