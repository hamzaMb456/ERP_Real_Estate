'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { FieldLabelWithHelp } from '@/components/field-help';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useT } from '@/i18n/provider';
import { isoToTunisParts } from '@/lib/appointments';
import { formatDate } from '@/lib/ownership';
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
  const t = useT().calendar.dialog;
  const { control } = useFormContext<AppointmentFormValues>();
  const units = useGraphql<{ units: UnitRow[] }>(UNITS_QUERY);
  const options = units.status === 'success' ? units.data.units : [];
  return (
    <Controller
      control={control}
      name="unitId"
      render={({ field }) => (
        <Field>
          <FieldLabelWithHelp htmlFor="appointment-unit" help={t.unitHelp}>
            {t.unit}
          </FieldLabelWithHelp>
          <Select value={field.value === '' ? NONE : field.value} onValueChange={(id) => field.onChange(id === NONE ? '' : id)}>
            <SelectTrigger id="appointment-unit" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t.noUnit}</SelectItem>
              {options.map((unit) => (
                <SelectItem key={unit.id} value={unit.id}>
                  <span dir="ltr">{unit.code}</span> · {unit.property.name}
                </SelectItem>
              ))}
              {/* An archived or hidden unit already on the appointment stays selectable. */}
              {field.value !== '' && !options.some((unit) => unit.id === field.value) && (
                <SelectItem value={field.value}>{t.currentUnit}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </Field>
      )}
    />
  );
}

function StaffSelect({ staff }: { staff: StaffOption[] }) {
  const t = useT().calendar.dialog;
  const { control } = useFormContext<AppointmentFormValues>();
  return (
    <Controller
      control={control}
      name="assignedUserId"
      render={({ field }) => (
        <Field>
          <FieldLabelWithHelp htmlFor="appointment-staff" help={t.staffHelp}>
            {t.staff}
          </FieldLabelWithHelp>
          <Select value={field.value === '' ? NONE : field.value} onValueChange={(id) => field.onChange(id === NONE ? '' : id)}>
            <SelectTrigger id="appointment-staff" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t.unassigned}</SelectItem>
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
  );
}

/** « Fin à 10:00 » under the duration, so the end is never a guess. */
function EndHint() {
  const t = useT().calendar.dialog;
  const { watch } = useFormContext<AppointmentFormValues>();
  const [date, time, duration] = watch(['date', 'time', 'duration']);
  const slot = slotOf({ date, time, duration });
  if (!slot) return null;
  const end = isoToTunisParts(slot.endsAt);
  return <FieldDescription aria-live="polite">{end.date === date ? t.endsAt(end.time) : t.endsOn(formatDate(end.date), end.time)}</FieldDescription>;
}

function WhenFields() {
  const t = useT().calendar.dialog;
  const { register, formState } = useFormContext<AppointmentFormValues>();
  const { errors } = formState;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Field data-invalid={!!errors.date}>
        <FieldLabelWithHelp htmlFor="appointment-date" help={t.dateHelp}>
          {t.date}
        </FieldLabelWithHelp>
        <Input id="appointment-date" type="date" dir="ltr" aria-invalid={!!errors.date} {...register('date')} />
        <FieldError errors={[errors.date]} />
      </Field>
      <Field data-invalid={!!errors.time}>
        <FieldLabelWithHelp htmlFor="appointment-time" help={t.timeHelp}>
          {t.time}
        </FieldLabelWithHelp>
        <Input id="appointment-time" type="time" dir="ltr" aria-invalid={!!errors.time} {...register('time')} />
        <FieldError errors={[errors.time]} />
      </Field>
      <Field data-invalid={!!errors.duration}>
        <FieldLabelWithHelp htmlFor="appointment-duration" help={t.durationHelp}>
          {t.duration}
        </FieldLabelWithHelp>
        <Input id="appointment-duration" inputMode="numeric" dir="ltr" aria-invalid={!!errors.duration} {...register('duration')} />
        <FieldError errors={[errors.duration]} />
        <EndHint />
      </Field>
    </div>
  );
}

export function AppointmentFormFields({ staff }: { staff: StaffOption[] }) {
  const { kinds, dialog: t } = useT().calendar;
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
              <FieldLabelWithHelp htmlFor="appointment-kind" help={t.kindHelp}>
                {t.kind}
              </FieldLabelWithHelp>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="appointment-kind" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPOINTMENT_KINDS.map((kind) => (
                    <SelectItem key={kind} value={kind}>
                      {kinds[kind]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        />
        <Field data-invalid={!!errors.title}>
          <FieldLabelWithHelp htmlFor="appointment-title" help={t.titleHelp}>
            {t.title}
          </FieldLabelWithHelp>
          <Input id="appointment-title" placeholder={t.titlePlaceholder} aria-invalid={!!errors.title} {...register('title')} />
          <FieldError errors={[errors.title]} />
        </Field>
      </div>

      <WhenFields />

      <div className="grid gap-4 sm:grid-cols-2">
        <StaffSelect staff={staff} />
        <UnitSelect />
      </div>

      <Field>
        <FieldLabelWithHelp htmlFor="appointment-location" help={t.locationHelp}>
          {t.location}
        </FieldLabelWithHelp>
        <Input id="appointment-location" placeholder={t.locationPlaceholder} {...register('location')} />
      </Field>

      <Field>
        <FieldLabelWithHelp htmlFor="appointment-notes" help={t.notesHelp}>
          {t.notes}
        </FieldLabelWithHelp>
        <Textarea id="appointment-notes" rows={2} {...register('notes')} />
      </Field>

      <Controller
        control={control}
        name="notifyByEmail"
        render={({ field }) => (
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              aria-label={t.notify}
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              className="mt-0.5"
            />
            <span>
              {t.notify}
              <span className="block text-xs text-muted-foreground">{t.notifyDescription}</span>
            </span>
          </label>
        )}
      />
    </FieldGroup>
  );
}
