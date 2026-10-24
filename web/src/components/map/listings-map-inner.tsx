'use client';

import 'leaflet/dist/leaflet.css';
import Link from 'next/link';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import { pinIcon } from '@/components/map/pin';
import { useI18n } from '@/i18n/provider';
import { TILE_ATTRIBUTION, TILE_URL, TUNISIA_CENTER, TUNISIA_ZOOM } from '@/lib/map-config';
import { cn } from '@/lib/utils';

/** One public listing on the map: texts are prepared by the caller (already translated and formatted). */
export type ListingMapPoint = {
  id: string;
  lat: number;
  lon: number;
  title: string;
  /** Price line, e.g. « 1 450,000 TND ». */
  detail: string;
  /** Short price for the price pin, e.g. « 1 450 TND ». */
  short?: string;
  /** City, shown under the title when known. */
  city?: string | null;
  /** Link of the popup; leave out (with `linkLabel`) on the listing's own page. */
  href?: string;
  linkLabel?: string;
};

// The marker takes the colour of the public site's primary (the map sits inside `.site-root`).
const PIN_COLOR = 'var(--primary)';

/** Public search map: one pin per located listing, its popup links to the listing page. Browser only (Leaflet). */
/** A price bubble instead of the plain pin: the visitor reads prices straight on the map. */
function priceIcon(text: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: '<span style="position:absolute;transform:translate(-50%,-50%);padding:5px 10px;border-radius:999px;background:var(--card);color:var(--foreground);border:1.5px solid var(--primary);font:700 12px/1 var(--font-sans, system-ui);white-space:nowrap;box-shadow:0 2px 8px rgb(0 0 0/.18)">' + text + '</span>',
  });
}

/** Public search map: one pin per located listing, its popup links to the listing page. Browser only (Leaflet). */
export function ListingsMapInner({
  points,
  label,
  className,
  pricePins = false,
}: {
  points: ListingMapPoint[];
  label: string;
  className?: string;
  pricePins?: boolean;
}) {
  const { dir } = useI18n();
  const bounds = points.length > 0 ? L.latLngBounds(points.map((point) => [point.lat, point.lon] as [number, number])) : undefined;
  // A new key re-creates the map so it fits the page's listings.
  const key = points.map((point) => point.id).join('|') || 'empty';

  return (
    <div role="region" aria-label={label} dir="ltr" className={cn('isolate overflow-hidden rounded-2xl border border-border', className ?? 'h-[60vh]')}>
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
          <Marker key={point.id} position={[point.lat, point.lon]} icon={pricePins && point.short ? priceIcon(point.short) : pinIcon(PIN_COLOR)}>
            <Popup>
              <div dir={dir} className="space-y-1 text-sm">
                <p className="font-semibold">{point.title}</p>
                {point.city ? <p className="text-muted-foreground">{point.city}</p> : null}
                <p className="font-semibold text-primary tabular-nums">{point.detail}</p>
                {point.href && point.linkLabel ? (
                  <Link href={point.href} className="font-medium text-primary underline">
                    {point.linkLabel}
                  </Link>
                ) : null}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
