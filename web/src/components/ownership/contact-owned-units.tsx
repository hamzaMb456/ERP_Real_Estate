'use client';

import Link from 'next/link';
import { Pulse } from '@/components/motion/primitives';
import { formatDateFr, formatPercent, ownershipPhase, todayIso } from '@/lib/ownership';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query ContactOwnerships($contactId: uuid!) {
    ownerships(where: { contact_id: { _eq: $contactId } }, order_by: [{ starts_on: desc }]) {
      id share_percent starts_on ends_on
      unit { id code property { id name } }
    }
  }
`;

type Row = {
  id: string;
  share_percent: number | string;
  starts_on: string;
  ends_on: string | null;
  unit: { id: string; code: string; property: { id: string; name: string } };
};

function UnitLine({ row, detail }: { row: Row; detail: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <Link href={'/biens/' + row.unit.property.id + '/unites/' + row.unit.id} className="min-w-0 hover:text-primary hover:underline">
        <span className="font-medium">{row.unit.code}</span>
        <span className="text-muted-foreground"> · {row.unit.property.name}</span>
      </Link>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{detail}</span>
    </li>
  );
}

export function ContactOwnedUnits({ contactId }: { contactId: string }) {
  const result = useGraphql<{ ownerships: Row[] }>(QUERY, { contactId });
  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">Chargement des unités…</Pulse>;
  if (result.status === 'error') return <p role="alert" className="text-sm text-destructive">Impossible de charger les unités : {result.message}</p>;

  const today = todayIso();
  const active = result.data.ownerships.filter((row) => ownershipPhase(row, today) !== 'past');
  const past = result.data.ownerships.filter((row) => ownershipPhase(row, today) === 'past');
  if (active.length === 0 && past.length === 0) {
    return <p className="text-sm text-muted-foreground">Aucune unité détenue pour le moment.</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      {active.length > 0 && (
        <ul className="divide-y">
          {active.map((row) => (
            <UnitLine
              key={row.id}
              row={row}
              detail={
                formatPercent(row.share_percent) +
                (row.starts_on > today ? ' · à partir du ' : ' · depuis le ') +
                formatDateFr(row.starts_on)
              }
            />
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Unités détenues auparavant</p>
          <ul className="divide-y opacity-80">
            {past.map((row) => (
              <UnitLine
                key={row.id}
                row={row}
                detail={formatDateFr(row.starts_on) + ' → ' + formatDateFr(row.ends_on as string)}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
