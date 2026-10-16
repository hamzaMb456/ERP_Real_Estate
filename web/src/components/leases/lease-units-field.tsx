'use client';

import { FieldHelp } from '@/components/field-help';
import { Checkbox } from '@/components/ui/checkbox';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { LeaseUnitInput } from '@/lib/lease-types';

import { useT } from '@/i18n/provider';
export type UnitOption = {
  id: string;
  code: string;
  rent_amount: number | string | null;
  property: { id: string; name: string };
};

type Props = {
  options: UnitOption[];
  value: LeaseUnitInput[];
  onChange: (value: LeaseUnitInput[]) => void;
};

const labelOf = (option: UnitOption) => `${option.code} · ${option.property.name}`;

export function LeaseUnitsField({ options, value, onChange }: Props) {
  const t = useT();
  function toggle(option: UnitOption, checked: boolean) {
    if (!checked) {
      onChange(value.filter((unit) => unit.unitId !== option.id));
      return;
    }
    const rent = option.rent_amount === null ? '' : String(Number(option.rent_amount));
    onChange([...value, { unitId: option.id, rent, charges: '' }]);
  }

  function edit(unitId: string, patch: Partial<LeaseUnitInput>) {
    onChange(value.map((unit) => (unit.unitId === unitId ? { ...unit, ...patch } : unit)));
  }

  return (
    <FieldSet>
      <FieldLegend variant="label" className="flex items-center gap-1.5">
        {t.leases.unitsField.legend}
        <FieldHelp>
          {t.leases.unitsField.help}
        </FieldHelp>
      </FieldLegend>
      <FieldDescription>{t.leases.unitsField.description}</FieldDescription>
      {options.length === 0 && <p className="text-sm text-muted-foreground">{t.leases.unitsField.none}</p>}
      <ul className="divide-y rounded-lg border">
        {options.map((option) => {
          const chosen = value.find((unit) => unit.unitId === option.id);
          return (
            <li key={option.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <label className="flex min-w-48 flex-1 items-center gap-2 text-sm">
                <Checkbox
                  aria-label={labelOf(option)}
                  checked={chosen !== undefined}
                  onCheckedChange={(checked) => toggle(option, checked === true)}
                />
                <span className="font-medium">{option.code}</span>
                <span className="text-muted-foreground">{option.property.name}</span>
              </label>
              {chosen && (
                <div className="flex gap-2">
                  <Input
                    aria-label={t.leases.unitsField.rentAria(option.code)}
                    placeholder={t.leases.unitsField.rentPlaceholder}
                    inputMode="decimal"
                    className="w-32"
                    value={chosen.rent}
                    onChange={(event) => edit(option.id, { rent: event.target.value })}
                  />
                  <Input
                    aria-label={t.leases.unitsField.chargesAria(option.code)}
                    placeholder={t.leases.unitsField.chargesPlaceholder}
                    inputMode="decimal"
                    className="w-32"
                    value={chosen.charges}
                    onChange={(event) => edit(option.id, { charges: event.target.value })}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </FieldSet>
  );
}
