'use client';

import { Plus, X } from '@/components/icons';
import { FieldHelp } from '@/components/field-help';
import { ContactPicker, type ContactOption } from '@/components/ownership/contact-picker';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldError, FieldLegend, FieldSet } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useT } from '@/i18n/provider';
import type { ParticipantRole } from '@/lib/appointment-types';
import { PARTICIPANT_ROLES } from './appointment-schema';

export type ParticipantRow = { contactId: string | null; role: ParticipantRole };

type Props = {
  value: ParticipantRow[];
  onChange: (value: ParticipantRow[]) => void;
  contacts: ContactOption[];
  error?: string;
};

export function AppointmentParticipantsField({ value, onChange, contacts, error }: Props) {
  const { participants: t, roles } = useT().calendar;
  const taken = value.flatMap((row) => (row.contactId ? [row.contactId] : []));
  const edit = (index: number, patch: Partial<ParticipantRow>) =>
    onChange(value.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  return (
    <FieldSet data-invalid={error !== undefined}>
      <FieldLegend variant="label" className="flex items-center gap-1.5">
        {t.legend}
        <FieldHelp>{t.help}</FieldHelp>
      </FieldLegend>
      <FieldDescription>{t.description}</FieldDescription>
      {value.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <div className="min-w-0 flex-1 basis-full sm:basis-auto">
            <ContactPicker
              id={`participant-${index}`}
              options={contacts}
              value={row.contactId}
              excludeIds={taken}
              onChange={(id) => edit(index, { contactId: id })}
              invalid={error !== undefined && row.contactId === null}
            />
          </div>
          <Select value={row.role} onValueChange={(role) => edit(index, { role: role as ParticipantRole })}>
            <SelectTrigger aria-label={t.roleLabel(index + 1)} className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTICIPANT_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {roles[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.remove(index + 1)}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      {error && <FieldError>{error}</FieldError>}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...value, { contactId: null, role: 'prospect' }])}>
        <Plus data-icon="inline-start" />
        {t.add}
      </Button>
    </FieldSet>
  );
}
