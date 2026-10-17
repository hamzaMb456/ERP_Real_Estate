import { afterEach, describe, expect, it } from 'vitest';
import { LOCALES, type Locale } from '@/i18n/config';
import { activateLocale } from '@/i18n/store';
import { MESSAGES } from '@/i18n/messages';

const SAMPLE_COUNTS = [0, 1, 2, 3, 11, 100];

/** Flattens a dictionary into `path → strings`, calling each function with every sample count. */
function flatten(value: unknown, path: string, locale: Locale, out: Map<string, string[]>): Map<string, string[]> {
  if (typeof value === 'string') return out.set(path, [value]);
  if (typeof value === 'function') {
    activateLocale(locale);
    const format = value as (count: number) => unknown;
    return out.set(path, SAMPLE_COUNTS.map((count) => String(format(count))));
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flatten(child, path ? `${path}.${key}` : key, locale, out);
    return out;
  }
  throw new Error(`Unexpected value at ${path}`);
}

const trees = Object.fromEntries(
  LOCALES.map((locale) => [locale, flatten(MESSAGES[locale].calendar, '', locale, new Map())]),
) as Record<Locale, Map<string, string[]>>;

afterEach(() => activateLocale('fr'));

describe('calendar dictionaries', () => {
  it('have the same key tree in French, English and Arabic', () => {
    const reference = [...trees.fr.keys()].sort();
    expect(reference.length).toBeGreaterThan(0);
    for (const locale of LOCALES) expect([...trees[locale].keys()].sort()).toEqual(reference);
  });

  it('have no empty string and no unreplaced # placeholder', () => {
    for (const locale of LOCALES) {
      for (const [path, values] of trees[locale]) {
        for (const text of values) {
          expect(text.trim(), `${locale} ${path}`).not.toBe('');
          expect(text, `${locale} ${path}`).not.toContain('#');
        }
      }
    }
  });

});
