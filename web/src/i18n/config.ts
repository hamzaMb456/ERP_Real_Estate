// Languages of the interface. French is the default: the team, the data and the E2E specs are French first.

export const LOCALES = ['fr', 'en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export type Direction = 'ltr' | 'rtl';

export const DEFAULT_LOCALE: Locale = 'fr';

/** Cookie that remembers the chosen language for a year. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Each language written in itself, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = { fr: 'Français', en: 'English', ar: 'العربية' };

/** BCP 47 tags for Intl: Tunisian conventions where they exist (ar-TN keeps Latin digits and Tunisian month names). */
export const INTL_LOCALES: Record<Locale, string> = { fr: 'fr-TN', en: 'en-GB', ar: 'ar-TN' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Runs in <head> before the first paint: sets <html lang dir> from the cookie so an Arabic page never flashes
 * left-to-right. Reading the cookie on the server instead would make the whole app request-bound (cacheComponents).
 */
export const LOCALE_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|;\\s*)${LOCALE_COOKIE}=(fr|en|ar)(?:;|$)/);if(m){var d=document.documentElement;d.lang=m[1];d.dir=m[1]==='ar'?'rtl':'ltr'}}catch(e){}})()`;
