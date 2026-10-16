import { getIntlLocale, getMessages } from '@/i18n/store';

// Amounts keep three decimals (millimes) in every language; only separators and the currency name change.
const fraction = { minimumFractionDigits: 3, maximumFractionDigits: 3 };

export function formatTnd(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  const { currency } = getMessages().common;
  return `${new Intl.NumberFormat(getIntlLocale(), fraction).format(Number(amount))} ${currency}`;
}

export function formatArea(squareMeters: number | string | null | undefined): string {
  if (squareMeters === null || squareMeters === undefined) return '—';
  const { squareMeters: unit } = getMessages().common;
  return `${new Intl.NumberFormat(getIntlLocale(), { maximumFractionDigits: 2 }).format(Number(squareMeters))} ${unit}`;
}

/** Plain number in the current language (counts, floors, rooms). */
export function formatNumber(value: number | string, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(getIntlLocale(), { maximumFractionDigits }).format(Number(value));
}
