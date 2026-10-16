// The chosen language, outside React: the cookie is the source of truth, the provider renders from it,
// and plain functions (formatters, error sentences, zod messages) read the language the tree renders with.

import { DEFAULT_LOCALE, INTL_LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, dirOf, isLocale, type Locale } from './config';
import { MESSAGES, type Messages } from './messages';

const listeners = new Set<() => void>();
let preferred: Locale | null = null;
let active: Locale = DEFAULT_LOCALE;

function readCookie(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]*)`).exec(document.cookie);
  const value = match ? decodeURIComponent(match[1]) : '';
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Client snapshot: the language saved in the cookie. */
export function preferredLocale(): Locale {
  preferred ??= readCookie();
  return preferred;
}

/** Server snapshot: the server never sees the choice, it always renders the default. */
export function serverLocale(): Locale {
  return DEFAULT_LOCALE;
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyToDocument(locale: Locale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = locale;
  document.documentElement.dir = dirOf(locale);
}

export function setLocale(locale: Locale): void {
  preferred = locale;
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  applyToDocument(locale);
  listeners.forEach((listener) => listener());
}

/** Called by I18nProvider while it renders, so code outside React matches the tree being rendered. */
export function activateLocale(locale: Locale): void {
  active = locale;
}

/** The language the interface renders in right now. */
export function getLocale(): Locale {
  return active;
}

/** Tag for Intl formatters (fr-TN, en-GB, ar-TN). */
export function getIntlLocale(): string {
  return INTL_LOCALES[active];
}

/** Dictionary of the current language, for code outside components (zod messages, error sentences, toasts in helpers). */
export function getMessages(): Messages {
  return MESSAGES[active];
}
