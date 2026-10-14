const tnd = new Intl.NumberFormat('fr-TN', {
  minimumFractionDigits: 3,
  maximumFractionDigits: 3,
});

const area = new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 2 });

export function formatTnd(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '—';
  return `${tnd.format(Number(amount))} TND`;
}

export function formatArea(squareMeters: number | string | null | undefined): string {
  if (squareMeters === null || squareMeters === undefined) return '—';
  return `${area.format(Number(squareMeters))} m²`;
}
