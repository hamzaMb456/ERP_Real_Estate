'use client';

import { Banknote } from 'lucide-react';
import { ChangeRentDialog } from '@/components/leases/change-rent-dialog';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatTnd } from '@/lib/format';
import { formatDate } from '@/lib/ownership';

import { useT } from '@/i18n/provider';
type Props = { lease: LeaseDetails; canEdit: boolean; onChanged: () => void };

/** Rent and charges history per unit; the row in force today is marked « En vigueur ». */
export function RentsTab({ lease, canEdit, onChanged }: Props) {
  const t = useT();
  return (
    <div className="space-y-4">
      {canEdit && lease.status === 'active' && (
        <div className="flex justify-end">
          <ChangeRentDialog
            lease={lease}
            onDone={onChanged}
            trigger={
              <Button variant="outline">
                <Banknote data-icon="inline-start" />
                {t.leases.rentsTab.change}
              </Button>
            }
          />
        </div>
      )}
      {lease.units.map(({ unit }) => {
        const rows = lease.rents.filter((rent) => rent.unit_id === unit.id);
        const inForce = lease.current_rents.find((rent) => rent.unit_id === unit.id)?.effective_from;
        return (
          <Card key={unit.id} className="gap-0 py-0">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-sm">
                {unit.code} · {unit.property.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.leases.rentsTab.colFrom}</TableHead>
                    <TableHead className="text-end">{t.leases.rentsTab.colRent}</TableHead>
                    <TableHead className="text-end">{t.leases.rentsTab.colCharges}</TableHead>
                    <TableHead>{t.leases.rentsTab.colReason}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((rent) => (
                    <TableRow key={rent.id}>
                      <TableCell>{formatDate(rent.effective_from)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatTnd(rent.rent_amount)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatTnd(rent.charges_amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{rent.reason ?? '—'}</TableCell>
                      <TableCell>{rent.effective_from === inForce && <Badge variant="secondary" className="bg-success/12 text-success">{t.leases.rentsTab.inForce}</Badge>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
