'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Users } from '@/components/icons';
import { StatusBadge } from '@/components/domain/badges';
import { TransferDialog } from '@/components/ownership/transfer-dialog';
import type { PropertyUnit } from '@/components/property/types';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatArea, formatTnd } from '@/lib/format';

import { useT } from '@/i18n/provider';
type Props = { propertyId: string; units: PropertyUnit[]; canEdit: boolean; onChanged: () => void };

function OwnerCell({ owners }: { owners: PropertyUnit['current_owners'] }) {
  const t = useT();
  if (owners.length === 0) return <span className="text-xs font-medium text-warning">{t.properties.unitsTable.noOwner}</span>;
  const [first, ...others] = owners;
  return (
    <span className="text-sm">
      <Link href={'/erp/contacts/' + first.contact.id} className="hover:text-primary hover:underline">
        {first.contact.full_name}
      </Link>
      {others.length > 0 && <span className="text-muted-foreground"> +{others.length}</span>}
    </span>
  );
}

export function PropertyUnitsTable({ propertyId, units, canEdit, onChanged }: Props) {
  const t = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const allIds = units.map((unit) => unit.id);
  const chosen = selected.filter((id) => allIds.includes(id));
  const targetIds = chosen.length > 0 ? chosen : allIds;
  const rows = units.flatMap((unit) => unit.ownerships);
  const headerState = chosen.length === 0 ? false : chosen.length === allIds.length ? true : 'indeterminate';

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b bg-muted/30 py-4">
        <CardTitle className="text-base">{t.properties.unitsTable.title(units.length)}</CardTitle>
        {canEdit && units.length > 0 && (
          <CardAction>
            <TransferDialog
              unitIds={targetIds}
              rows={rows}
              title={chosen.length > 0 ? t.properties.unitsTable.transferSelected(chosen.length) : t.properties.unitsTable.transferAll}
              description={t.properties.unitsTable.transferDescription}
              trigger={
                <Button variant="outline" size="sm">
                  <Users data-icon="inline-start" />
                  {chosen.length > 0 ? t.properties.unitsTable.transferButtonSelected(chosen.length) : t.properties.unitsTable.transferButtonAll}
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
          <p className="font-medium">{t.properties.unitsTable.emptyTitle}</p>
          <p className="text-sm text-muted-foreground">{t.properties.unitsTable.emptyBody}</p>
        </CardContent>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {canEdit && (
                <TableHead className="w-10 ps-4">
                  <Checkbox
                    aria-label={t.properties.unitsTable.selectAll}
                    checked={headerState}
                    onCheckedChange={(checked) => setSelected(checked === true ? allIds : [])}
                  />
                </TableHead>
              )}
              <TableHead className={canEdit ? '' : 'ps-4'}>{t.properties.unitsTable.colUnit}</TableHead>
              <TableHead>{t.properties.unitsTable.colOwner}</TableHead>
              <TableHead className="hidden md:table-cell">{t.properties.unitsTable.colFloor}</TableHead>
              <TableHead className="hidden sm:table-cell">{t.properties.unitsTable.colSurface}</TableHead>
              <TableHead className="text-end">{t.properties.unitsTable.colRent}</TableHead>
              <TableHead className="pe-4">{t.properties.unitsTable.colStatus}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit) => (
              <TableRow key={unit.id} data-state={chosen.includes(unit.id) ? 'selected' : undefined}>
                {canEdit && (
                  <TableCell className="ps-4">
                    <Checkbox
                      aria-label={t.properties.unitsTable.select(unit.code)}
                      checked={chosen.includes(unit.id)}
                      onCheckedChange={(checked) =>
                        setSelected((current) => (checked === true ? [...current, unit.id] : current.filter((id) => id !== unit.id)))
                      }
                    />
                  </TableCell>
                )}
                <TableCell className={canEdit ? '' : 'ps-4'}>
                  <Link href={'/erp/biens/' + propertyId + '/unites/' + unit.id} className="font-medium hover:text-primary hover:underline">
                    {unit.code}
                  </Link>
                  <span className="ms-2 text-xs text-muted-foreground">{t.labels.unitTypes[unit.type] ?? unit.type}</span>
                </TableCell>
                <TableCell>
                  <OwnerCell owners={unit.current_owners} />
                </TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">{unit.floor ?? '—'}</TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">{formatArea(unit.surface_m2)}</TableCell>
                <TableCell className="text-end font-medium tabular-nums">{formatTnd(unit.rent_amount)}</TableCell>
                <TableCell className="pe-4">
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
