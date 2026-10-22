'use client';

import { useState } from 'react';
import Link from 'next/link';
import { MapPinOff } from '@/components/icons';
import { PropertiesMap, type MapPoint } from '@/components/map';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OCCUPANCY, occupancyLevel, type OccupancyLevel } from '@/lib/occupancy';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';
const QUERY = `
  query PropertiesMap {
    properties(where: { archived_at: { _is_null: true } }, order_by: { name: asc }) {
      id name city latitude longitude
      branch { id name }
      units(where: { archived_at: { _is_null: true } }) { status }
    }
  }
`;

type Row = {
  id: string;
  name: string;
  city: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  branch: { id: string; name: string } | null;
  units: { status: string }[];
};

export default function PropertiesMapPage() {
  const t = useT();
  const result = useGraphql<{ properties: Row[] }>(QUERY);
  const [city, setCity] = useState('all');
  const [branch, setBranch] = useState('all');
  const rows = result.status === 'success' ? result.data.properties : [];
  const cities = [...new Set(rows.map((row) => row.city).filter((value): value is string => !!value))].sort();
  const branches = [...new Map(rows.flatMap((row) => (row.branch ? [[row.branch.id, row.branch.name] as const] : [])))];
  const filtered = rows.filter((row) => (city === 'all' || row.city === city) && (branch === 'all' || row.branch?.id === branch));
  const placed = filtered.filter((row) => row.latitude !== null && row.longitude !== null);
  const missing = filtered.filter((row) => row.latitude === null || row.longitude === null);
  const points: MapPoint[] = placed.map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    lat: Number(row.latitude),
    lon: Number(row.longitude),
    level: occupancyLevel(row.units.map((unit) => unit.status)),
    units: row.units.length,
    rented: row.units.filter((unit) => unit.status === 'rented').length,
  }));

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader title={t.properties.map.title} description={t.properties.map.description} />
      </StaggerItem>

      <StaggerItem>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-44" aria-label={t.properties.map.city}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.properties.map.allCities}</SelectItem>
              {cities.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={branch} onValueChange={setBranch}>
            <SelectTrigger className="w-48" aria-label={t.properties.map.branch}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.properties.map.allBranches}</SelectItem>
              {branches.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-label={t.properties.map.legend}>
            {(Object.keys(OCCUPANCY) as OccupancyLevel[]).map((level) => (
              <li key={level} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: OCCUPANCY[level].color }} aria-hidden />
                {t.properties.map.occupancy[level]}
              </li>
            ))}
          </ul>
        </div>
      </StaggerItem>

      {result.status === 'loading' && <SkeletonList count={1} itemClassName="h-[60vh] rounded-xl bg-muted" label={t.properties.map.loading} />}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.properties.map.loadError(result.message)}
        </p>
      )}

      {result.status === 'success' && (
        <StaggerItem>
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            <PropertiesMap points={points} />
            <div className="space-y-4">
              <Card className="gap-0 py-0">
                <CardHeader className="border-b py-3">
                  <CardTitle className="text-sm">{t.properties.map.onMap(points.length)}</CardTitle>
                </CardHeader>
                <CardContent className="max-h-80 overflow-y-auto p-0">
                  <ul className="divide-y text-sm">
                    {points.map((point) => (
                      <li key={point.id} className="flex items-center gap-2 px-4 py-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: OCCUPANCY[point.level].color }} aria-hidden />
                        <Link href={'/biens/' + point.id} className="truncate hover:text-primary hover:underline">
                          {point.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              {missing.length > 0 && (
                <Card className="gap-0 py-0">
                  <CardHeader className="border-b py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <MapPinOff className="size-4 text-muted-foreground" aria-hidden />
                      {t.properties.map.noPosition(missing.length)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y text-sm">
                      {missing.map((row) => (
                        <li key={row.id} className="flex items-center justify-between gap-2 px-4 py-2">
                          <span className="truncate">{row.name}</span>
                          <Link href={'/biens/' + row.id + '/modifier'} className="shrink-0 text-xs font-medium text-primary hover:underline">
                            {t.properties.map.placeOnMap}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </StaggerItem>
      )}
    </Stagger>
  );
}
