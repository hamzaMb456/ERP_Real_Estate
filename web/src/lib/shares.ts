// Common-area shares in thousandths (tantièmes). The building total must be exactly 1000.

export const SHARE_TOTAL = 1000;

export type ShareInput = { id: string; surface: number | string | null };

/** Splits 1000 by surface with the largest-remainder method; equal split when no surface is known. */
export function suggestShares(units: ShareInput[]): Record<string, number> {
  if (units.length === 0) return {};
  const weights = units.map((unit) => {
    const surface = Number(unit.surface);
    return unit.surface !== null && Number.isFinite(surface) && surface > 0 ? surface : 0;
  });
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const effective = weightSum > 0 ? weights : units.map(() => 1);
  const total = weightSum > 0 ? weightSum : units.length;

  const raw = effective.map((weight) => (weight / total) * SHARE_TOTAL);
  const shares = raw.map(Math.floor);
  let remaining = SHARE_TOTAL - shares.reduce((sum, share) => sum + share, 0);
  const order = raw
    .map((value, index) => ({ index, rest: value - shares[index] }))
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (const { index } of order) {
    if (remaining <= 0) break;
    shares[index] += 1;
    remaining -= 1;
  }

  return Object.fromEntries(units.map((unit, index) => [unit.id, shares[index]]));
}

export function sharesTotal(values: (number | null | undefined)[]): number {
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}
