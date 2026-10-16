import { getIntlLocale } from './store';

/** Forms per CLDR plural category; `other` is required. Arabic uses zero/one/two/few/many/other, French and English one/other. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

/** Picks the form for `count` in the current language. `#` in the form is replaced by the count. */
export function plural(count: number, forms: PluralForms): string {
  const category = new Intl.PluralRules(getIntlLocale()).select(count);
  return (forms[category] ?? forms.other).replace('#', String(count));
}
