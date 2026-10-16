'use client';

import { Plus, X } from 'lucide-react';
import { ContactPicker, type ContactOption } from '@/components/ownership/contact-picker';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PARTICIPANT_ROLE_LABELS } from '@/lib/appointments';
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
  const taken = value.flatMap((row) => (row.contactId ? [row.contactId] : []));
  const edit = (index: number, patch: Partial<ParticipantRow>) =>
    onChange(value.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  return (
    <FieldSet>
      <FieldLegend variant="label">Participants</FieldLegend>
      <FieldDescription>Les participants reçoivent une invitation par e-mail s’ils ont une adresse.</FieldDescription>
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
            <SelectTrigger aria-label={`Rôle du participant ${index + 1}`} className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PARTICIPANT_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {PARTICIPANT_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Retirer le participant ${index + 1}`}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => onChange([...value, { contactId: null, role: 'prospect' }])}>
        <Plus data-icon="inline-start" />
        Ajouter un participant
      </Button>
    </FieldSet>
  );
}
