'use client';

import { createContext, Fragment, useContext, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { Direction as RadixDirection } from 'radix-ui';
import { DEFAULT_LOCALE, dirOf, type Direction, type Locale } from './config';
import { MESSAGES, type Messages } from './messages';
import { activateLocale, applyToDocument, preferredLocale, serverLocale, setLocale, subscribeLocale } from './store';

type I18nValue = { locale: Locale; dir: Direction; t: Messages; setLocale: (locale: Locale) => void };

// Without a provider (unit tests), components render in French.
const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  dir: dirOf(DEFAULT_LOCALE),
  t: MESSAGES[DEFAULT_LOCALE],
  setLocale,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // Hydrates with the server's French, then switches to the cookie's language right after.
  const locale = useSyncExternalStore(subscribeLocale, preferredLocale, serverLocale);
  activateLocale(locale);

  // React resets <html> attributes on the dev Strict Mode remount; put them back before paint.
  useLayoutEffect(() => applyToDocument(locale), [locale]);

  const value = useMemo(() => ({ locale, dir: dirOf(locale), t: MESSAGES[locale], setLocale }), [locale]);

  // Remount on change: formatted dates, amounts and memoised labels all pick up the new language at once.
  return (
    <I18nContext.Provider value={value}>
      {/* Radix popovers, menus and sheets read their direction from here, not from <html dir>. */}
      <RadixDirection.Provider dir={value.dir}>
        <Fragment key={locale}>{children}</Fragment>
      </RadixDirection.Provider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** The dictionary of the current language: `const t = useT(); t.common.save`. */
export function useT(): Messages {
  return useContext(I18nContext).t;
}
