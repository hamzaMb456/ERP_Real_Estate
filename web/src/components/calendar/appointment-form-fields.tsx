'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { APPOINTMENT_KIND_LABELS, isoToTunisParts } from '@/lib/appointments';
import { useGraphql } from '@/lib/use-graphql';
import { APPOINTMENT_KINDS, slotOf, type AppointmentFormValues } from './appointment-schema';
import type { StaffOption } from './calendar-types';

const NONE = 'none';

const UNITS_QUERY = `
  query AppointmentUnits {
    units(where: { archived_at: { _is_null: true }, property: { archived_at: { _is_null: true } } }, order_by: [{ property: { name: asc } }, { code: asc }]) {
      id code property { name }
    }
  }
`;

type UnitRow = { id: string; code: string; property: { name: string } };

function UnitSelect() {
  const { control } = useFormContext<AppointmentFormValues>();
  const units = useGraphql<{ units: UnitRow[] }>(UNITS_QUERY);
  const options = units.status === 'success' ? units.data.units : [];
  return (
    <Controller
      control={control}
      name="unitId"
      render={({ field }) => (
        <Field>
          <FieldLabel htmlFor="appointment-unit">Unité concernée</FieldLabel>
          <Select value={field.value === '' ? NONE : field.value} onValueChange={(id) => field.onChange(id === NONE ? '' : id)}>
            <SelectTrigger id="appointment-unit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Aucune unité</SelectItem>
              {options.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  {unit.code} · {unit.property.name}
                </SelectItem>
              ))}
              {/* An archived or hidden unit already on the appointment stays selectable. */}
              {field.value !== '' && !options.some((unit) => unit.id === field.value) && (
                <SelectItem value={field.value}>Unité actuelle</SelectItem>
              )}
            </SelectContent>
          </Select>
        </Field>
      )}
    />
  );
}

/** « Fin à 10:00 » under the duration, so the end is never a guess. */
function EndHint() {
  const { watch } = useFormContext<AppointmentFormValues>();
  const [date, time, duration] = watch(['date', 'time', 'duration']);
  const slot = slotOf({ date, time, duration });
  if (!slot) return null;
  const end = isoToTunisParts(slot.endsAt);
  return <FieldDescription>{end.date === date ? `Fin à ${end.time}` : `Fin le ${end.date} à ${end.time}`}</FieldDescription>;
}

export function AppointmentFormFields({ staff }: { staff: StaffOption[] }) {
  const { control, register, formState } = useFormContext<AppointmentFormValues>();
  const { errors } = formState;

  return (
    <FieldGroup>
      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="appointment-kind">Type *</FieldLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="appointment-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {APPOINTMENT_KIND_LABELS[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Field data-invalid={!!errors.title}>
          <FieldLabel htmlFor="appointment-title">Titre *</FieldLabel>
          <Input id="appointment-title" placeholder="Visite de l’appartement B-101" aria-invalid={!!errors.title} {...register('title')} />
          <FieldError errors={[errors.title]} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field data-invalid={!!errors.date}>
          <FieldLabel htmlFor="appointment-date">Date *</FieldLabel>
          <Input id="appointment-date" type="date" aria-invalid={!!errors.date} {...register('date')} />
          <FieldError errors={[errors.date]} />
        </Field>
        <Field data-invalid={!!errors.time}>
          <FieldLabel htmlFor="appointment-time">Heure *</FieldLabel>
          <Input id="appointment-time" type="time" aria-invalid={!!errors.time} {...register('time')} />
          <FieldError errors={[errors.time]} />
        </Field>
        <Field data-invalid={!!errors.duration}>
          <FieldLabel htmlFor="appointment-duration">Durée (minutes) *</FieldLabel>
          <Input id="appointment-duration" inputMode="numeric" aria-invalid={!!errors.duration} {...register('duration')} />
          <FieldError errors={[errors.duration]} />
          <EndHint />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="assignedUserId"
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="appointment-staff">Collaborateur en charge</FieldLabel>
              <Select value={field.value === '' ? NONE : field.value} onValueChange={(id) => field.onChange(id === NONE ? '' : id)}>
                <SelectTrigger id="appointment-staff" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Non assigné</SelectItem>
                  {staff.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <UnitSelect />
      </div>

      <Field>
        <FieldLabel htmlFor="appointment-location">Lieu</FieldLabel>
        <Input id="appointment-location" placeholder="Adresse ou point de rendez-vous" {...register('location')} />
      </Field>

      <Field>
        <FieldLabel htmlFor="appointment-notes">Notes</FieldLabel>
        <Textarea id="appointment-notes" rows={2} {...register('notes')} />
      </Field>

      <Controller
        control={control}
        name="notifyByEmail"
        render={({ field }) => (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              aria-label="Prévenir par e-mail"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              className="mt-0.5"
            />
            <span>
              Prévenir par e-mail
              <span className="block text-xs text-muted-foreground">
                Invitation, report et annulation sont envoyés aux participants qui ont une adresse e-mail.
              </span>
            </span>
          </label>
        )}
      />
    </FieldGroup>
  );
}
