'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { StatusBadge } from '@/components/domain/badges';
import { UNIT_TYPES } from '@/components/domain/labels';
import { TransferDialog } from '@/components/ownership/transfer-dialog';
import type { PropertyUnit } from '@/components/property/types';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatArea, formatTnd } from '@/lib/format';

type Props = { propertyId: string; units: PropertyUnit[]; canEdit: boolean; onChanged: () => void };

function OwnerCell({ owners }: { owners: PropertyUnit['current_owners'] }) {
  if (owners.length === 0) return <span className="text-xs font-medium text-warning">Aucun</span>;
  const [first, ...others] = owners;
  return (
    <span className="text-sm">
      <Link href={'/contacts/' + first.contact.id} className="hover:text-primary hover:underline">
        {first.contact.full_name}
      </Link>
      {others.length > 0 && <span className="text-muted-foreground"> +{others.length}</span>}
    </span>
  );
}

export function PropertyUnitsTable({ propertyId, units, canEdit, onChanged }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const allIds = units.map((unit) => unit.id);
  const chosen = selected.filter((id) => allIds.includes(id));
  const targetIds = chosen.length > 0 ? chosen : allIds;
  const rows = units.flatMap((unit) => unit.ownerships);
  const headerState = chosen.length === 0 ? false : chosen.length === allIds.length ? true : 'indeterminate';

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/30 py-4">
        <CardTitle className="text-base">Unités ({units.length})</CardTitle>
        {canEdit && units.length > 0 && (
          <CardAction>
            <TransferDialog
              unitIds={targetIds}
              rows={rows}
              title={chosen.length > 0 ? `Définir le propriétaire de ${chosen.length} unité(s)` : 'Définir le propriétaire de toutes les unités'}
              description="Les propriétaires actuels de ces unités cessent de les détenir la veille de la date choisie."
              trigger={
                <Button variant="outline" size="sm">
                  <Users data-icon="inline-start" />
                  {chosen.length > 0 ? `Définir le propriétaire (${chosen.length})` : 'Même propriétaire pour toutes'}
                </Button>
              }
              onDone={() => {
                setSelected([]);
                onChanged();
              }}
            />
          </CardAction>
        )}
      </CardHeader>
      {units.length === 0 ? (
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="font-medium">Aucune unité pour ce bien</p>
          <p className="text-sm text-muted-foreground">Ajoutez les appartements, bureaux ou commerces pour suivre loyers, occupation et propriétaires.</p>
        </CardContent>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {canEdit && (
                <TableHead className="w-10 pl-4">
                  <Checkbox
                    aria-label="Sélectionner toutes les unités"
                    checked={headerState}
                    onCheckedChange={(checked) => setSelected(checked === true ? allIds : [])}
                  />
                </TableHead>
              )}
              <TableHead className={canEdit ? '' : 'pl-4'}>Unité</TableHead>
              <TableHead>Propriétaire</TableHead>
              <TableHead className="hidden md:table-cell">Étage</TableHead>
              <TableHead className="hidden sm:table-cell">Surface</TableHead>
              <TableHead className="text-right">Loyer</TableHead>
              <TableHead className="pr-4">Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => (
              <TableRow key={unit.id} data-state={chosen.includes(unit.id) ? 'selected' : undefined}>
                {canEdit && (
                  <TableCell className="pl-4">
                    <Checkbox
                      aria-label={'Sélectionner ' + unit.code}
                      checked={chosen.includes(unit.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) => (checked === true ? [...current, unit.id] : current.filter((id) => id !== unit.id)))
                      }
                    />
                  </TableCell>
                )}
                <TableCell className={canEdit ? '' : 'pl-4'}>
                  <Link href={'/biens/' + propertyId + '/unites/' + unit.id} className="font-medium hover:text-primary hover:underline">
                    {unit.code}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">{UNIT_TYPES[unit.type] ?? unit.type}</span>
                </TableCell>
                <TableCell>
                  <OwnerCell owners={unit.current_owners} />
                </TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">{unit.floor ?? '—'}</TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{formatArea(unit.surface_m2)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatTnd(unit.rent_amount)}</TableCell>
                <TableCell className="pr-4">
                  <StatusBadge status={unit.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
