'use client';

import { X } from 'lucide-react';
import { ContactPicker, type ContactOption } from '@/components/ownership/contact-picker';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { APPOINTMENT_KIND_LABELS } from '@/lib/appointments';
import { LEASE_EVENT_KIND_LABELS } from '@/lib/calendar';
import type { BranchOption, CalendarFilterState, StaffOption } from './calendar-types';

type Props = {
  value: CalendarFilterState;
  staff: StaffOption[];
  contacts: ContactOption[];
  branches: BranchOption[];
  onChange: (next: CalendarFilterState) => void;
};

const ALL = 'all';
const KIND_LABELS: Record<string, string> = { ...APPOINTMENT_KIND_LABELS, ...LEASE_EVENT_KIND_LABELS };

export function CalendarFilters({ value, staff, contacts, branches, onChange }: Props) {
  const patch = (next: Partial<CalendarFilterState>) => onChange({ ...value, ...next });

  return (
    <div className="space-y-4">
      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        value={value.kinds}
        onValueChange={(kinds) => patch({ kinds })}
        className="flex-wrap justify-start"
        aria-label="Types d’événements"
      >
        {Object.entries(KIND_LABELS).map(([kind, label]) => (
          <ToggleGroupItem key={kind} value={kind}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="filter-staff">Collaborateur</FieldLabel>
          <Select value={value.staffId ?? ALL} onValueChange={(id) => patch({ staffId: id === ALL ? null : id })}>
            <SelectTrigger id="filter-staff" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous les collaborateurs</SelectItem>
              {staff.map((member) => (
                <SelectItem key={member.user_id} value={member.user_id}>
                  {member.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="filter-branch">Agence</FieldLabel>
          <Select value={value.branchId ?? ALL} onValueChange={(id) => patch({ branchId: id === ALL ? null : id })}>
            <SelectTrigger id="filter-branch" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes les agences</SelectItem>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="filter-contact">Contact</FieldLabel>
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <ContactPicker id="filter-contact" options={contacts} value={value.contactId} onChange={(id) => patch({ contactId: id })} />
            </div>
            {value.contactId && (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Retirer le filtre contact" onClick={() => patch({ contactId: null })}>
                <X />
              </Button>
            )}
          </div>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          aria-label="Afficher les rendez-vous annulés"
          checked={value.includeCancelled}
          onCheckedChange={(checked) => patch({ includeCancelled: checked === true })}
        />
        Afficher les rendez-vous annulés
      </label>
    </div>
  );
}
