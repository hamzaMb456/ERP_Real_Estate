'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { FieldLabelWithHelp } from '@/components/field-help';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';

import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/provider';
const ADD_UNIT = `
  mutation AddUnit($object: units_insert_input!) {
    insert_units_one(object: $object) { id }
  }
`;

const UPDATE_UNIT = `
  mutation UpdateUnit($id: uuid!, $set: units_set_input!) {
    update_units_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

const optionalInt = (label: string, min: number) =>
  z
    .string()
    .trim()
    .refine((value) => value === '' || (/^-?\d+$/.test(value) && Number(value) >= min), label);

const optionalNumber = (label: string, minExclusive: boolean) =>
  z
    .string()
    .trim()
    .refine((value) => {
      if (value === '') return true;
      const parsed = Number(value.replace(',', '.'));
      return Number.isFinite(parsed) && (minExclusive ? parsed > 0 : parsed >= 0);
    }, label);

function makeSchema(m: Messages['properties']['unitForm']) {
  return z.object({
  code: z.string().trim().min(1, m.codeRequired),
  type: z.enum(['apartment', 'office', 'shop', 'parking', 'house', 'land']),
  status: z.enum(['vacant', 'rented', 'for_sale', 'sold', 'under_maintenance']),
  floor: optionalInt(m.floorInvalid, -10),
  rooms: optionalInt(m.roomsInvalid, 0),
  surface_m2: optionalNumber(m.surfaceInvalid, true),
  rent_amount: optionalNumber(m.rentInvalid, false),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

export type UnitFormUnit = {
  id: string;
  code: string;
  type: string;
  status: string;
  floor: number | null;
  rooms: number | null;
  surface_m2: number | string | null;
  rent_amount: number | string | null;
};

const EMPTY: FormValues = { code: '', type: 'apartment', status: 'vacant', floor: '', rooms: '', surface_m2: '', rent_amount: '' };

const asText = (value: number | string | null) => (value === null ? '' : String(value));
const toNumberOrNull = (value: string) => (value === '' ? null : Number(value.replace(',', '.')));

function toFormValues(unit: UnitFormUnit): FormValues {
  return {
    code: unit.code,
    type: unit.type as FormValues['type'],
    status: unit.status as FormValues['status'],
    floor: asText(unit.floor),
    rooms: asText(unit.rooms),
    surface_m2: asText(unit.surface_m2),
    rent_amount: asText(unit.rent_amount),
  };
}

type Props = {
  propertyId: string;
  unit?: UnitFormUnit;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
};

export function UnitDialog({ propertyId, unit, trigger, open, onOpenChange, onSaved }: Props) {
  const t = useT();
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (open === undefined) setInnerOpen(next);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{unit ? t.properties.unitForm.editTitle(unit.code) : t.properties.unitForm.addTitle}</DialogTitle>
          <DialogDescription>
            {unit ? t.properties.unitForm.editDescription : t.properties.unitForm.addDescription}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from fresh values. */}
        <UnitForm
          propertyId={propertyId}
          unit={unit}
          onCancel={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onSaved();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function UnitForm({
  propertyId,
  unit,
  onCancel,
  onSaved,
}: {
  propertyId: string;
  unit?: UnitFormUnit;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const schema = useMemo(() => makeSchema(t.properties.unitForm), [t]);
  const { control, register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: unit ? toFormValues(unit) : EMPTY,
  });
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: FormValues) {
    const fields = {
      code: values.code,
      type: values.type,
      status: values.status,
      floor: toNumberOrNull(values.floor),
      rooms: toNumberOrNull(values.rooms),
      surface_m2: toNumberOrNull(values.surface_m2),
      rent_amount: toNumberOrNull(values.rent_amount),
    };
    try {
      if (unit) {
        await graphql(UPDATE_UNIT, { id: unit.id, set: fields });
        toast.success(t.properties.unitForm.updated, { description: values.code });
      } else {
        await graphql(ADD_UNIT, { object: { ...fields, property_id: propertyId } });
        toast.success(t.properties.unitForm.created, { description: t.properties.unitForm.createdBody(values.code) });
      }
      onSaved();
    } catch (error) {
      toast.error(t.properties.form.saveFailed, { description: toUserMessage(error, { unitCode: values.code }) });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.code}>
            <FieldLabelWithHelp htmlFor="unit-code" help={t.properties.unitForm.codeHelp}>
              {t.properties.unitForm.code}
            </FieldLabelWithHelp>
            <Input
              id="unit-code"
              placeholder={t.properties.unitForm.codePlaceholder}
              aria-invalid={!!errors.code}
              aria-describedby={errors.code ? 'unit-code-error' : undefined}
              {...register('code')}
            />
            <FieldError id="unit-code-error" errors={[errors.code]} />
          </Field>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Field>
                <FieldLabelWithHelp htmlFor="unit-type" help={t.properties.unitForm.typeHelp}>
                  {t.properties.unitForm.type}
                </FieldLabelWithHelp>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="unit-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(t.labels.unitTypes).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <Field data-invalid={!!errors.floor}>
            <FieldLabelWithHelp htmlFor="unit-floor" help={t.properties.unitForm.floorHelp}>
              {t.properties.unitForm.floor}
            </FieldLabelWithHelp>
            <Input id="unit-floor" inputMode="numeric" placeholder="1" aria-invalid={!!errors.floor} {...register('floor')} />
            <FieldError errors={[errors.floor]} />
          </Field>
          <Field data-invalid={!!errors.rooms}>
            <FieldLabelWithHelp htmlFor="unit-rooms" help={t.properties.unitForm.roomsHelp}>
              {t.properties.unitForm.rooms}
            </FieldLabelWithHelp>
            <Input id="unit-rooms" inputMode="numeric" placeholder="3" aria-invalid={!!errors.rooms} {...register('rooms')} />
            <FieldError errors={[errors.rooms]} />
          </Field>
          <Field data-invalid={!!errors.surface_m2}>
            <FieldLabelWithHelp htmlFor="unit-surface" help={t.properties.unitForm.surfaceHelp}>
              {t.properties.unitForm.surface}
            </FieldLabelWithHelp>
            <InputGroup>
              <InputGroupInput id="unit-surface" inputMode="decimal" placeholder="92" aria-invalid={!!errors.surface_m2} {...register('surface_m2')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t.common.squareMeters}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[errors.surface_m2]} />
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.rent_amount}>
            <FieldLabelWithHelp htmlFor="unit-rent" help={t.properties.unitForm.rentHelp}>
              {t.properties.unitForm.rent}
            </FieldLabelWithHelp>
            <InputGroup>
              <InputGroupInput id="unit-rent" inputMode="decimal" placeholder="980,000" aria-invalid={!!errors.rent_amount} {...register('rent_amount')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t.common.currency}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[errors.rent_amount]} />
          </Field>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Field>
                <FieldLabelWithHelp
                  htmlFor="unit-status"
                  help={t.properties.unitForm.statusHelp}
                >
                  {t.properties.unitForm.status}
                </FieldLabelWithHelp>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="unit-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(t.labels.unitStatuses).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {isSubmitting ? t.common.saving : unit ? t.common.save : t.properties.unitForm.submitAdd}
        </Button>
      </DialogFooter>
    </form>
  );
}
