'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Pulse } from '@/components/motion/primitives';
import { AddCoOwnerDialog } from '@/components/ownership/add-coowner-dialog';
import { TransferDialog } from '@/components/ownership/transfer-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { formatDateFr, formatPercent, ownershipPhase, rowsToReopen, todayIso, type OwnershipRow } from '@/lib/ownership';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

const QUERY = `
  query UnitOwnerships($unitId: uuid!) {
    ownerships(where: { unit_id: { _eq: $unitId } }, order_by: [{ starts_on: desc }]) {
      id unit_id contact_id share_percent starts_on ends_on notes
      contact { id full_name is_organization }
    }
  }
`;

const DELETE_OWNERSHIP = `
  mutation DeleteOwnership($id: uuid!, $reopen: [uuid!]!) {
    delete_ownerships_by_pk(id: $id) { id }
    update_ownerships(where: { id: { _in: $reopen } }, _set: { ends_on: null }) { affected_rows }
  }
`;

type Row = OwnershipRow & { notes: string | null; contact: { id: string; full_name: string; is_organization: boolean } };

function OwnerLine({ row, detail, onDelete }: { row: Row; detail: string; onDelete?: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <Link href={'/contacts/' + row.contact.id} className="font-medium hover:text-primary hover:underline">
          {row.contact.full_name}
        </Link>
        {row.contact.is_organization && (
          <Badge variant="secondary" className="ml-2">
            Votre société
          </Badge>
        )}
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-sm font-semibold tabular-nums">{formatPercent(row.share_percent)}</span>
        {onDelete && (
          <Button variant="ghost" size="icon-sm" aria-label={'Supprimer la ligne de ' + row.contact.full_name} onClick={onDelete}>
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  );
}

export function UnitOwnersTab({ unitId }: { unitId: string }) {
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [toDelete, setToDelete] = useState<Row | null>(null);
  const result = useGraphql<{ ownerships: Row[] }>(QUERY, { unitId }, reload);
  const refresh = () => setReload((value) => value + 1);

  if (result.status === 'loading') return <Pulse className="text-sm text-muted-foreground">Chargement des propriétaires…</Pulse>;
  if (result.status === 'error') {
    return (
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Impossible de charger les propriétaires : {result.message}
      </p>
    );
  }

  const rows = result.data.ownerships;
  const today = todayIso();
  const current = rows.filter((row) => ownershipPhase(row, today) === 'current');
  const upcoming = rows.filter((row) => ownershipPhase(row, today) === 'upcoming');
  const past = rows.filter((row) => ownershipPhase(row, today) === 'past');
  const held = current.reduce((sum, row) => sum + Number(row.share_percent), 0);
  const askDelete = canEdit ? (row: Row) => () => setToDelete(row) : () => undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Propriétaires actuels</CardTitle>
          <CardDescription>
            {current.length === 0 ? 'Aucun propriétaire enregistré pour cette unité.' : 'Part totale détenue : ' + formatPercent(held)}
          </CardDescription>
          {canEdit && (
            <CardAction className="flex flex-wrap gap-2">
              {current.length > 0 && <AddCoOwnerDialog unitId={unitId} remaining={100 - held} onDone={refresh} />}
              <TransferDialog
                unitIds={[unitId]}
                rows={rows}
                title={current.length === 0 ? 'Définir le propriétaire' : 'Transférer la propriété'}
                description="Choisissez la date et les nouveaux propriétaires avec leur part. Le total doit faire 100 %."
                trigger={
                  <Button>
                    <ArrowRightLeft data-icon="inline-start" />
                    {current.length === 0 ? 'Définir le propriétaire' : 'Transférer la propriété'}
                  </Button>
                }
                onDone={refresh}
              />
            </CardAction>
          )}
        </CardHeader>
        {current.length > 0 && (
          <CardContent>
            <ul className="divide-y">
              {current.map((row) => (
                <OwnerLine key={row.id} row={row} detail={'Depuis le ' + formatDateFr(row.starts_on)} />
              ))}
            </ul>
          </CardContent>
        )}
      </Card>

      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">À venir</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {upcoming.map((row) => (
                <OwnerLine key={row.id} row={row} detail={'À partir du ' + formatDateFr(row.starts_on)} onDelete={canEdit ? askDelete(row) : undefined} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique</CardTitle>
          <CardDescription>Propriétaires précédents de l’unité.</CardDescription>
        </CardHeader>
        <CardContent>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pas encore d’historique.</p>
          ) : (
            <ul className="divide-y">
              {past.map((row) => (
                <OwnerLine
                  key={row.id}
                  row={row}
                  detail={'Du ' + formatDateFr(row.starts_on) + ' au ' + formatDateFr(row.ends_on as string)}
                  onDelete={canEdit ? askDelete(row) : undefined}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer cette ligne ?"
        description={
          toDelete
            ? ownershipPhase(toDelete, today) === 'upcoming'
              ? `Le transfert prévu à ${toDelete.contact.full_name} sera annulé et les propriétaires précédents conserveront l’unité.`
              : `La détention de ${toDelete.contact.full_name} sera effacée de l’historique. À utiliser seulement pour corriger une erreur de saisie.`
            : ''
        }
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            const reopen = ownershipPhase(toDelete, today) === 'upcoming' ? rowsToReopen(rows, toDelete) : [];
            await graphql(DELETE_OWNERSHIP, { id: toDelete.id, reopen });
            toast.success('Ligne supprimée');
            refresh();
          } catch (error) {
            toast.error('Suppression impossible', { description: toFrenchError(error) });
          }
        }}
      />
    </div>
  );
}
