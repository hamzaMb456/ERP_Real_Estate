import { describe, expect, it, vi } from 'vitest';
import { addressQuery, buildGeocodeUrl, geocodeAddress, roundPosition } from './geocode';

const okResponse = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('buildGeocodeUrl', () => {
  it('limits the search to Tunisia, 5 results, French labels', () => {
    const url = new URL(buildGeocodeUrl('Avenue Habib Bourguiba, Carthage'));
    expect(url.origin + url.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(url.searchParams.get('countrycodes')).toBe('tn');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('accept-language')).toBe('fr');
    expect(url.searchParams.get('q')).toBe('Avenue Habib Bourguiba, Carthage');
  });
});

describe('geocodeAddress', () => {
  it('parses results', async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse([{ display_name: 'Carthage, Tunis', lat: '36.8528', lon: '10.3233' }]));
    await expect(geocodeAddress('Carthage', fetcher)).resolves.toEqual([{ label: 'Carthage, Tunis', lat: 36.8528, lon: 10.3233 }]);
  });
  it('returns no result when the service refuses (HTTP 429) or is unreachable', async () => {
    await expect(geocodeAddress('Carthage', vi.fn().mockResolvedValue(new Response('slow down', { status: 429 })))).resolves.toEqual([]);
    await expect(geocodeAddress('Carthage', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))).resolves.toEqual([]);
  });
  it('skips malformed rows and too-short queries', async () => {
    const fetcher = vi.fn().mockResolvedValue(okResponse([{ display_name: 'x', lat: 'n/a', lon: '1' }, { foo: 1 }]));
    await expect(geocodeAddress('Carthage', fetcher)).resolves.toEqual([]);
    const unused = vi.fn();
    await expect(geocodeAddress('ab', unused)).resolves.toEqual([]);
    expect(unused).not.toHaveBeenCalled();
  });
});

describe('helpers', () => {
  it('joins address parts and rounds positions to 6 decimals', () => {
    expect(addressQuery([' 14 Rue des Jardins ', '', null, 'Carthage'])).toBe('14 Rue des Jardins, Carthage');
    expect(roundPosition({ lat: 36.85280049, lon: 10.32331951 })).toEqual({ lat: 36.8528, lon: 10.32332 });
  });
});
