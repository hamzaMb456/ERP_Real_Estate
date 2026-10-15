'use client';

import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { pinIcon } from '@/components/map/pin';
import { TILE_ATTRIBUTION, TILE_URL, TUNISIA_CENTER, TUNISIA_ZOOM } from '@/lib/map-config';
import { OCCUPANCY, type OccupancyLevel } from '@/lib/occupancy';
import { cn } from '@/lib/utils';

export type MapPoint = {
  id: string;
  name: string;
  city: string | null;
  lat: number;
  lon: number;
  level: OccupancyLevel;
  units: number;
  rented: number;
};

export function PropertiesMapInner({ points, className }: { points: MapPoint[]; className?: string }) {
  const bounds = points.length > 0 ? L.latLngBounds(points.map((point) => [point.lat, point.lon] as [number, number])) : undefined;
  // A new key re-creates the map so it fits the filtered biens.
  const key = points.map((point) => point.id).join('|') || 'empty';

  return (
    <div className={cn('isolate overflow-hidden rounded-xl border', className ?? 'h-[60vh]')}>
      <MapContainer
        key={key}
        bounds={bounds}
        boundsOptions={{ padding: [40, 40], maxZoom: 15 }}
        center={bounds ? undefined : TUNISIA_CENTER}
        zoom={bounds ? undefined : TUNISIA_ZOOM}
        className="size-full"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {points.map((point) => (
          <Marker key={point.id} position={[point.lat, point.lon]} icon={pinIcon(OCCUPANCY[point.level].color)}>
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{point.name}</p>
                {point.city && <p className="text-muted-foreground">{point.city}</p>}
                <p>
                  {point.rented} / {point.units} unités louées
                </p>
                <Link href={'/biens/' + point.id} className="font-medium text-primary underline">
                  Ouvrir la fiche
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
