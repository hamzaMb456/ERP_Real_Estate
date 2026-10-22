'use client';

import dynamic from 'next/dynamic';

// Leaflet needs `window`: load the map only in the browser.
export const LocationPicker = dynamic(() => import('./location-picker-inner').then((module) => module.LocationPickerInner), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-lg bg-muted" />,
});

export const PropertiesMap = dynamic(() => import('./properties-map-inner').then((module) => module.PropertiesMapInner), {
  ssr: false,
  loading: () => <div className="h-[60vh] animate-pulse rounded-xl bg-muted" />,
});

export const ListingsMap = dynamic(() => import('./listings-map-inner').then((module) => module.ListingsMapInner), {
  ssr: false,
  loading: () => <div className="h-[60vh] animate-pulse rounded-2xl bg-muted" />,
});

export type { MapPoint } from './properties-map-inner';
export type { ListingMapPoint } from './listings-map-inner';
