// Address search through OpenStreetMap Nominatim, used only on an explicit click
// (fair-use policy: no per-keystroke requests). Any failure means "no result":
// staff then place the pin by hand.

export type GeocodeResult = { label: string; lat: number; lon: number };
export type LatLon = { lat: number; lon: number };
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';

export function buildGeocodeUrl(query: string): string {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', countrycodes: 'tn', limit: '5', 'accept-language': 'fr' });
  return `${ENDPOINT}?${params.toString()}`;
}

export async function geocodeAddress(
  query: string,
  fetcher: Fetcher = (url, init) => fetch(url, init),
): Promise<GeocodeResult[]> {
  const term = query.trim();
  if (term.length < 3) return [];
  let response: Response;
  try {
    response = await fetcher(buildGeocodeUrl(term), { headers: { Accept: 'application/json' } });
  } catch {
    return [];
  }
  if (!response.ok) return [];
  const data: unknown = await response.json().catch(() => null);
  if (!Array.isArray(data)) return [];
  return data
    .flatMap((item: { display_name?: unknown; lat?: unknown; lon?: unknown }) => {
      const lat = Number(item?.lat);
      const lon = Number(item?.lon);
      return typeof item?.display_name === 'string' && Number.isFinite(lat) && Number.isFinite(lon)
        ? [{ label: item.display_name, lat, lon }]
        : [];
    })
    .slice(0, 5);
}

export function addressQuery(parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

/** The database stores positions as numeric(9,6). */
export function roundPosition(value: LatLon): LatLon {
  return { lat: Math.round(value.lat * 1e6) / 1e6, lon: Math.round(value.lon * 1e6) / 1e6 };
}
