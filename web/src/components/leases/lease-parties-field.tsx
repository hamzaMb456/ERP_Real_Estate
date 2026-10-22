'use client';

import type { ReactNode } from 'react';
import { Plus, X } from '@/components/icons';
import { FieldHelp } from '@/components/field-help';
import { ContactPicker, type ContactOption } from '@/components/ownership/contact-picker';
import { Button } from '@/components/ui/button';
import { FieldLegend, FieldSet } from '@/components/ui/field';

import { useT } from '@/i18n/provider';
type Props = {
  legend: string;
  /** Explanation shown in the help popover next to the legend. */
  help: ReactNode;
  addLabel: string;
  /** Singular noun used in the accessible names of the rows: « Retirer locataire 1 ». */
  rowLabel: string;
  value: (string | null)[];
  onChange: (value: (string | null)[]) => void;
  options: ContactOption[];
  /** Contacts already used on the lease (renters and guarantors): each can appear only once. */
  taken: string[];
  minRows: number;
};

export function LeasePartiesField({ legend, help, addLabel, rowLabel, value, onChange, options, taken, minRows }: Props) {
  const t = useT();
  return (
    <FieldSet>
      <FieldLegend variant="label" className="flex items-center gap-1.5">
        {legend}
        <FieldHelp>{help}</FieldHelp>
      </FieldLegend>
      {value.map((contactId, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ContactPicker
              id={`${rowLabel}-${index}`}
              options={options}
              value={contactId}
              excludeIds={taken}
              onChange={(id) => onChange(value.map((current, position) => (position === index ? id : current)))}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.leases.form.removeRow(rowLabel, index + 1)}
            disabled={value.length <= minRows}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...value, null])}>
        <Plus data-icon="inline-start" />
        {addLabel}
      </Button>
    </FieldSet>
  );
}
