'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { pinIcon } from '@/components/map/pin';
import type { LatLon } from '@/lib/geocode';
import { DETAIL_ZOOM, TILE_ATTRIBUTION, TILE_URL, TUNISIA_CENTER, TUNISIA_ZOOM } from '@/lib/map-config';
import { cn } from '@/lib/utils';

function ClickToPlace({ onChange }: { onChange: (value: LatLon) => void }) {
  useMapEvents({ click: (event) => onChange({ lat: event.latlng.lat, lon: event.latlng.lng }) });
  return null;
}

/** Re-centres the map when the position changes (search result, drag). */
function Follow({ lat, lon }: { lat: number | null; lon: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== null && lon !== null) map.setView([lat, lon], Math.max(map.getZoom(), DETAIL_ZOOM));
  }, [map, lat, lon]);
  return null;
}

export function LocationPickerInner({
  value,
  onChange,
  className,
}: {
  value: LatLon | null;
  onChange?: (value: LatLon) => void;
  className?: string;
}) {
  const editable = onChange !== undefined;
  // Only a finite position may reach Leaflet — a NaN/undefined coordinate crashes MapContainer.
  const position = value && Number.isFinite(value.lat) && Number.isFinite(value.lon) ? value : null;
  return (
    <div dir="ltr" className={cn('isolate overflow-hidden rounded-lg border', className ?? 'h-64')}>
      <MapContainer
        center={position ? [position.lat, position.lon] : TUNISIA_CENTER}
        zoom={position ? DETAIL_ZOOM : TUNISIA_ZOOM}
        scrollWheelZoom={editable}
        className="size-full"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {editable && <ClickToPlace onChange={onChange} />}
        <Follow lat={position?.lat ?? null} lon={position?.lon ?? null} />
        {position && (
          <Marker
            position={[position.lat, position.lon]}
            icon={pinIcon('var(--primary)')}
            draggable={editable}
            eventHandlers={
              editable
                ? {
                    dragend: (event) => {
                      const position = event.target.getLatLng();
                      onChange({ lat: position.lat, lon: position.lng });
                    },
                  }
                : undefined
            }
          />
        )}
      </MapContainer>
    </div>
  );
}
