'use client';

import Link from 'next/link';
import { LeaseFlagBadges, LeaseStatusBadge } from '@/components/leases/lease-status-badge';
import { Pulse } from '@/components/motion/primitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeaseStatus, RegistrationState } from '@/lib/lease-types';
import { formatLeaseNumber, leasePeriod } from '@/lib/leases';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query ContactLeases($id: uuid!, $role: String!) {
    lease_parties(where: { contact_id: { _eq: $id }, role: { _eq: $role } }, order_by: [{ lease: { number: desc } }]) {
      lease {
        id number status start_date end_date
        overview { is_ending_soon in_grace grace_days_left registration_state registration_deadline }
        units { unit { code property { name } } }
      }
    }
  }
`;

type Row = {
  lease: {
    id: string;
    number: number;
    status: LeaseStatus;
    start_date: string;
    end_date: string;
    overview: { is_ending_soon: boolean; in_grace: boolean; grace_days_left: number | null; registration_state: RegistrationState; registration_deadline: string | null } | null;
    units: { unit: { code: string; property: { name: string } } }[];
  };
};

function LeaseRows({ rows }: { rows: Row[] }) {
  return (
    <ul className="divide-y">
      {rows.map(({ lease }) => (
        <li key={lease.id} className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
          <div>
            <Link href={'/baux/' + lease.id} className="font-medium text-primary hover:underline">
              {formatLeaseNumber(lease.number)}
            </Link>
            <p className="text-xs text-muted-foreground">
              {lease.units.map(({ unit }) => `${unit.code} · ${unit.property.name}`).join(', ')} · {leasePeriod(lease)}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <LeaseStatusBadge status={lease.status} />
            {lease.overview && <LeaseFlagBadges row={{ ...lease.overview, end_date: lease.end_date, status: lease.status }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Leases rented by this contact, shown inside the « Locataire » role card. */
export function ContactRenterLeases({ contactId }: { contactId: string }) {
  const result = useGraphql<{ lease_parties: Row[] }>(QUERY, { id: contactId, role: 'renter' });
  if (result.status === 'loading') return <Pulse>Chargement des baux…</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-destructive">Impossible de charger les baux : {result.message}</p>;
  if (result.data.lease_parties.length === 0) return <p>Aucun bail pour le moment.</p>;
  return <LeaseRows rows={result.data.lease_parties} />;
}

/** Leases this contact guarantees: its own card, absent when there are none. */
export function ContactGuaranteedLeases({ contactId }: { contactId: string }) {
  const result = useGraphql<{ lease_parties: Row[] }>(QUERY, { id: contactId, role: 'guarantor' });
  if (result.status !== 'success' || result.data.lease_parties.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Garant</CardTitle>
        <CardDescription>Baux que ce contact garantit.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <LeaseRows rows={result.data.lease_parties} />
      </CardContent>
    </Card>
  );
}
