'use client';

import Link from 'next/link';
import { FilePlus2 } from 'lucide-react';
import { LeaseFlagBadges } from '@/components/leases/lease-status-badge';
import { Pulse } from '@/components/motion/primitives';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTnd } from '@/lib/format';
import { formatLeaseNumber, leasePeriod } from '@/lib/leases';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query UnitLease($id: uuid!) {
    unit_current_lease(where: { unit_id: { _eq: $id } }, order_by: [{ start_date: asc }]) {
      lease_id number start_date end_date renter_names in_grace is_ending_soon rent_amount charges_amount
    }
  }
`;

type Row = {
  lease_id: string;
  number: number;
  start_date: string;
  end_date: string;
  renter_names: string | null;
  in_grace: boolean;
  is_ending_soon: boolean;
  rent_amount: number | string | null;
  charges_amount: number | string | null;
};

export function UnitLeaseCard({ unitId, canCreate }: { unitId: string; canCreate: boolean }) {
  const result = useGraphql<{ unit_current_lease: Row[] }>(QUERY, { id: unitId });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bail en cours</CardTitle>
        <CardDescription>Le bail actif de cette unité et son locataire.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {result.status === 'loading' && <Pulse className="text-muted-foreground">Chargement…</Pulse>}
        {result.status === 'error' && <p role="alert" className="text-destructive">Impossible de charger le bail : {result.message}</p>}
        {result.status === 'success' && result.data.unit_current_lease.length === 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground">Aucun bail actif.</p>
            {canCreate && (
              <Button asChild variant="outline" size="sm">
                <Link href={'/baux/nouveau?unite=' + unitId}>
                  <FilePlus2 data-icon="inline-start" />
                  Créer un bail
                </Link>
              </Button>
            )}
          </div>
        )}
        {result.status === 'success' &&
          result.data.unit_current_lease.map((row) => (
            <div key={row.lease_id} className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <Link href={'/baux/' + row.lease_id} className="font-medium text-primary hover:underline">
                  {formatLeaseNumber(row.number)}
                </Link>
                <p className="text-muted-foreground">{row.renter_names ?? '—'}</p>
                <p className="text-xs text-muted-foreground">{leasePeriod(row)}</p>
                <div className="flex flex-wrap gap-1.5">
                  <LeaseFlagBadges row={{ ...row, grace_days_left: null, registration_state: 'registered', registration_deadline: null }} />
                </div>
              </div>
              <p className="font-medium tabular-nums">{row.rent_amount === null ? '—' : formatTnd(row.rent_amount)}</p>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}
