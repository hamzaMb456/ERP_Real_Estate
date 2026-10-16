'use client';

import { useState } from 'react';
import { Loader2, MapPinOff, Search } from 'lucide-react';
import { LocationPicker } from '@/components/map';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { geocodeAddress, roundPosition, type GeocodeResult, type LatLon } from '@/lib/geocode';

import { useT } from '@/i18n/provider';
import { formatNumber } from '@/lib/format';
type Props = {
  query: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (value: LatLon | null) => void;
};

export function LocationField({ query, latitude, longitude, onChange }: Props) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const value = latitude !== null && longitude !== null ? { lat: latitude, lon: longitude } : null;

  const place = (position: LatLon) => {
    onChange(roundPosition(position));
    setResults(null);
  };

  async function run() {
    const term = search.trim() || query;
    if (!term) {
      setResults([]);
      return;
    }
    setSearching(true);
    const found = await geocodeAddress(term);
    setSearching(false);
    if (found.length === 1) place(found[0]);
    else setResults(found);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            aria-label={t.properties.locationField.searchLabel}
            value={search}
            placeholder={query || t.properties.locationField.searchPlaceholder}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void run();
              }
            }}
          />
        </InputGroup>
        <Button type="button" variant="outline" onClick={() => void run()} disabled={searching}>
          {searching && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {t.properties.locationField.search}
        </Button>
      </div>

      {results !== null &&
        (results.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            {t.properties.locationField.notFound}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {results.map((result) => (
              <li key={result.lat + ',' + result.lon}>
                <button type="button" className="w-full px-3 py-2 text-start hover:bg-muted" onClick={() => place(result)}>
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        ))}

      <LocationPicker value={value} onChange={place} className="h-72" />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {value
            ? t.properties.locationField.position(formatNumber(value.lat, 6), formatNumber(value.lon, 6))
            : t.properties.locationField.hint}
        </span>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <MapPinOff data-icon="inline-start" />
            {t.properties.locationField.clear}
          </Button>
        )}
      </div>
    </div>
  );
}
