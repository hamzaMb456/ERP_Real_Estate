'use client';

import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { LeaseActionDialog } from '@/components/leases/lease-action-dialog';
import { FieldLabelWithHelp } from '@/components/field-help';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addDays, todayTunis } from '@/lib/dates';
import { graphql } from '@/lib/graphql';
import { parseMoney } from '@/lib/leases';
import { formatDate } from '@/lib/ownership';

import { useT } from '@/i18n/provider';
const CHANGE_RENT = `
  mutation ChangeRent($id: uuid!, $unit: uuid!, $on: date!, $rent: numeric!, $charges: numeric!, $reason: String) {
    change_rent(args: { p_lease_id: $id, p_unit_id: $unit, p_effective_from: $on, p_rent: $rent, p_charges: $charges, p_reason: $reason }) { id }
  }
`;

type Props = { lease: Pick<LeaseDetails, 'id' | 'units' | 'current_rents'>; trigger: ReactNode; onDone: () => void };

export function ChangeRentDialog({ lease, trigger, onDone }: Props) {
  const t = useT();
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
      title={t.leases.changeRent.title}
      description={t.leases.changeRent.description}
      submitLabel={t.common.save}
      disabled={!unitId || !effectiveOn}
      onSubmit={async () => {
        const newRent = parseMoney(rent);
        const newCharges = charges.trim() === '' ? 0 : parseMoney(charges);
        if (newRent === null || newCharges === null) throw new Error(t.leases.changeRent.invalid);
        await graphql(CHANGE_RENT, { id: lease.id, unit: unitId, on: effectiveOn, rent: newRent, charges: newCharges, reason: reason.trim() || null });
        toast.success(t.leases.changeRent.done, { description: t.common.from(formatDate(effectiveOn)) });
        onDone();
      }}
    >
      {lease.units.length > 1 && (
        <Field>
          <FieldLabelWithHelp htmlFor="rent-unit" help={t.leases.changeRent.unitHelp}>
            {t.leases.changeRent.unit}
          </FieldLabelWithHelp>
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
        <FieldLabelWithHelp htmlFor="rent-date" help={t.leases.changeRent.fromHelp}>
          {t.leases.changeRent.from}
        </FieldLabelWithHelp>
        <Input id="rent-date" type="date" required value={effectiveOn} onChange={(event) => setEffectiveOn(event.target.value)} className="w-48" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabelWithHelp htmlFor="rent-amount" help={t.leases.changeRent.rentHelp}>
            {t.leases.changeRent.rent}
          </FieldLabelWithHelp>
          <Input id="rent-amount" inputMode="decimal" value={rent} onChange={(event) => setRent(event.target.value)} />
        </Field>
        <Field>
          <FieldLabelWithHelp htmlFor="rent-charges" help={t.leases.changeRent.chargesHelp}>
            {t.leases.changeRent.charges}
          </FieldLabelWithHelp>
          <Input id="rent-charges" inputMode="decimal" value={charges} onChange={(event) => setCharges(event.target.value)} />
        </Field>
      </div>
      <Field>
        <FieldLabelWithHelp htmlFor="rent-reason" help={t.leases.changeRent.reasonHelp}>
          {t.leases.changeRent.reason}
        </FieldLabelWithHelp>
        <Input id="rent-reason" placeholder={t.leases.changeRent.reasonPlaceholder} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </LeaseActionDialog>
  );
}
