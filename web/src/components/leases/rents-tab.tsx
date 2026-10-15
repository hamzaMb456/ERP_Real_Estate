'use client';

import { Banknote } from 'lucide-react';
import { ChangeRentDialog } from '@/components/leases/change-rent-dialog';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatTnd } from '@/lib/format';
import { formatDateFr } from '@/lib/ownership';

type Props = { lease: LeaseDetails; canEdit: boolean; onChanged: () => void };

/** Rent and charges history per unit; the row in force today is marked « En vigueur ». */
export function RentsTab({ lease, canEdit, onChanged }: Props) {
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
                Changer le loyer
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
                    <TableHead>À partir du</TableHead>
                    <TableHead className="text-right">Loyer</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((rent) => (
                    <TableRow key={rent.id}>
                      <TableCell>{formatDateFr(rent.effective_from)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatTnd(rent.rent_amount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatTnd(rent.charges_amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{rent.reason ?? '—'}</TableCell>
                      <TableCell>{rent.effective_from === inForce && <Badge variant="secondary" className="bg-success/12 text-success">En vigueur</Badge>}</TableCell>
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
