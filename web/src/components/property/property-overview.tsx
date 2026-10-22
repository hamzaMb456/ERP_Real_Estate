'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { MapPin, Users } from '@/components/icons';
import { AnimatedNumber, GrowBar, HoverLift } from '@/components/motion/primitives';
import { LocationPicker } from '@/components/map';
import type { PropertyDetails, PropertyUnit } from '@/components/property/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatArea, formatTnd } from '@/lib/format';

import { useT } from '@/i18n/provider';
function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <HoverLift className="h-full rounded-xl">
      <Card className="h-full py-4">
        <CardContent className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <div className="text-2xl font-semibold tabular-nums tracking-tight">{children}</div>
        </CardContent>
      </Card>
    </HoverLift>
  );
}

export function PropertyOverview({ property, units }: { property: PropertyDetails; units: PropertyUnit[] }) {
  const t = useT();
  const rented = units.filter((unit) => unit.status === 'rented');
  const occupancy = units.length === 0 ? 0 : Math.round((rented.length / units.length) * 100);
  const rentTotal = rented.reduce((sum, unit) => sum + Number(unit.rent_amount ?? 0), 0);
  const surfaceTotal = units.reduce((sum, unit) => sum + Number(unit.surface_m2 ?? 0), 0);
  const address = [property.address_line, property.postal_code, property.city, property.governorate].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t.properties.overview.units}>
          <AnimatedNumber value={units.length} />
        </Stat>
        <Stat label={t.properties.overview.occupancy}>
          <AnimatedNumber value={occupancy} format={(n) => Math.round(n) + ' %'} />
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <GrowBar percent={occupancy} className="bg-primary" />
          </div>
        </Stat>
        <Stat label={t.properties.overview.monthlyRents}>{formatTnd(rentTotal)}</Stat>
        <Stat label={t.properties.overview.totalSurface}>{formatArea(surfaceTotal)}</Stat>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="size-4 text-muted-foreground" aria-hidden />
              {t.properties.overview.address}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {address ? <p className="font-medium">{address}</p> : <p className="text-muted-foreground">{t.properties.overview.noAddress}</p>}
            {property.latitude !== null && property.longitude !== null ? (
              <LocationPicker value={{ lat: Number(property.latitude), lon: Number(property.longitude) }} className="h-48" />
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={'/biens/' + property.id + '/modifier'}>{t.properties.overview.placeOnMap}</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4 text-muted-foreground" aria-hidden />
              {t.properties.overview.owners}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {property.owners.length === 0 ? (
              <p className="text-muted-foreground">{t.properties.overview.noOwners}</p>
            ) : (
              <ul className="divide-y">
                {property.owners.map((owner) => (
                  <li key={owner.contact.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <Link href={'/contacts/' + owner.contact.id} className="font-medium hover:text-primary hover:underline">
                        {owner.contact.full_name}
                      </Link>
                      {owner.contact.is_organization && (
                        <Badge variant="secondary" className="ms-2">
                          {t.properties.overview.yourCompany}
                        </Badge>
                      )}
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {t.properties.overview.unitCount(owner.units_count)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
