import type { PublicListing } from './listings-queries';

const PRICE_BAND = 0.25;

/** Two listings share a city only when both have one: no city is never "the same city". */
function sameCity(a: string | null, b: string | null): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Listings close to `base`: same kind (rent or sale) and city, price within +-25 %, never `base` itself, closest
 * price first (ties keep the candidates' order). `limit` defaults to 3.
 */
export function pickSimilar(base: PublicListing, candidates: PublicListing[], limit = 3): PublicListing[] {
  if (!(base.price > 0) || limit <= 0) return [];
  const low = base.price * (1 - PRICE_BAND);
  const high = base.price * (1 + PRICE_BAND);
  return candidates
    .filter(
      (c) =>
        c.id !== base.id && c.kind === base.kind && sameCity(c.city, base.city) && c.price >= low && c.price <= high,
    )
    .map((c, index) => ({ c, index, distance: Math.abs(c.price - base.price) }))
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .slice(0, limit)
    .map(({ c }) => c);
}
