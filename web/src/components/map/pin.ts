import L from 'leaflet';

/** Coloured map pin drawn in SVG (Leaflet's default image icons break with bundlers). */
export function pinIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [28, 36],
    iconAnchor: [14, 34],
    popupAnchor: [0, -30],
    html: `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 36 14 36s14-11.7 14-22.1C28 6.2 21.7 0 14 0z" style="fill:${color}" stroke="#ffffff" stroke-width="1.5"/><circle cx="14" cy="14" r="5.5" fill="#ffffff"/></svg>`,
  });
}
