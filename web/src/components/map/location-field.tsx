'use client';

import { useState } from 'react';
import { Loader2, MapPinOff, Search } from 'lucide-react';
import { LocationPicker } from '@/components/map';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { geocodeAddress, roundPosition, type GeocodeResult, type LatLon } from '@/lib/geocode';

type Props = {
  query: string;
  latitude: number | null;
  longitude: number | null;
  onChange: (value: LatLon | null) => void;
};

export function LocationField({ query, latitude, longitude, onChange }: Props) {
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
            aria-label="Rechercher l’adresse sur la carte"
            value={search}
            placeholder={query || 'Ex. Avenue Habib Bourguiba, Carthage'}
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
          Rechercher
        </Button>
      </div>

      {results !== null &&
        (results.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            Adresse introuvable, placez le repère sur la carte.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {results.map((result) => (
              <li key={result.lat + ',' + result.lon}>
                <button type="button" className="w-full px-3 py-2 text-left hover:bg-muted" onClick={() => place(result)}>
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
            ? `Position : ${String(value.lat).replace('.', ',')} · ${String(value.lon).replace('.', ',')}`
            : 'Cliquez sur la carte pour placer le repère, puis faites-le glisser pour ajuster.'}
        </span>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <MapPinOff data-icon="inline-start" />
            Retirer la position
          </Button>
        )}
      </div>
    </div>
  );
}
