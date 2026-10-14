const tnd = new Intl.NumberFormat('fr-TN', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

export function formatTnd(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `${tnd.format(Number(amount))} TND`;
}
