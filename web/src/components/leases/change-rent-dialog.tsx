'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { LeaseActionDialog } from '@/components/leases/lease-action-dialog';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, todayTunis } from '@/lib/dates';
import { graphql } from '@/lib/graphql';
import { parseMoney } from '@/lib/leases';
import { formatDateFr } from '@/lib/ownership';

const CHANGE_RENT = `
  mutation ChangeRent($id: uuid!, $unit: uuid!, $on: date!, $rent: numeric!, $charges: numeric!, $reason: String) {
    change_rent(args: { p_lease_id: $id, p_unit_id: $unit, p_effective_from: $on, p_rent: $rent, p_charges: $charges, p_reason: $reason }) { id }
  }
`;

type Props = { lease: Pick<LeaseDetails, 'id' | 'units' | 'current_rents'>; trigger: ReactNode; onDone: () => void };

export function ChangeRentDialog({ lease, trigger, onDone }: Props) {
  const firstUnit = lease.units[0]?.unit.id ?? '';
  const [unitId, setUnitId] = useState(firstUnit);
  const [effectiveOn, setEffectiveOn] = useState(addDays(todayTunis(), 1));
  const current = lease.current_rents.find((rent) => rent.unit_id === unitId);
  const [rent, setRent] = useState(current ? String(Number(current.rent_amount)) : '');
  const [charges, setCharges] = useState(current && Number(current.charges_amount) > 0 ? String(Number(current.charges_amount)) : '');
  const [reason, setReason] = useState('');

  function pickUnit(next: string) {
    setUnitId(next);
    const row = lease.current_rents.find((item) => item.unit_id === next);
    setRent(row ? String(Number(row.rent_amount)) : '');
    setCharges(row && Number(row.charges_amount) > 0 ? String(Number(row.charges_amount)) : '');
  }

  return (
    <LeaseActionDialog
      trigger={trigger}
      title="Changer le loyer"
      description="Le nouveau loyer s’applique à partir de la date choisie ; l’historique est conservé."
      submitLabel="Enregistrer"
      disabled={!unitId || !effectiveOn}
      onSubmit={async () => {
        const newRent = parseMoney(rent);
        const newCharges = charges.trim() === '' ? 0 : parseMoney(charges);
        if (newRent === null || newCharges === null) throw new Error('Le loyer et les charges doivent être des montants valides.');
        await graphql(CHANGE_RENT, { id: lease.id, unit: unitId, on: effectiveOn, rent: newRent, charges: newCharges, reason: reason.trim() || null });
        toast.success('Loyer enregistré', { description: 'À partir du ' + formatDateFr(effectiveOn) });
        onDone();
      }}
    >
      {lease.units.length > 1 && (
        <Field>
          <FieldLabel htmlFor="rent-unit">Unité</FieldLabel>
          <Select value={unitId} onValueChange={pickUnit}>
            <SelectTrigger id="rent-unit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lease.units.map(({ unit }) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.code} · {unit.property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor="rent-date">À partir du</FieldLabel>
        <Input id="rent-date" type="date" required value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} className="w-48" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="rent-amount">Loyer (TND)</FieldLabel>
          <Input id="rent-amount" inputMode="decimal" value={rent} onChange={(event) => setRent(event.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="rent-charges">Charges (TND)</FieldLabel>
          <Input id="rent-charges" inputMode="decimal" value={charges} onChange={(event) => setCharges(event.target.value)} />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor="rent-reason">Motif (facultatif)</FieldLabel>
        <Input id="rent-reason" placeholder="Indexation annuelle" value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </LeaseActionDialog>
  );
}
