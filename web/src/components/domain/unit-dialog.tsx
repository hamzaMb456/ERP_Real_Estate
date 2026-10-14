'use client';

import { useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { UNIT_STATUSES, UNIT_TYPES } from '@/components/domain/labels';
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';

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

const schema = z.object({
  code: z.string().trim().min(1, 'Saisissez la référence de l’unité (ex. B-101).'),
  type: z.enum(['apartment', 'office', 'shop', 'parking', 'house', 'land']),
  status: z.enum(['vacant', 'rented', 'for_sale', 'sold', 'under_maintenance']),
  floor: optionalInt('Étage invalide : nombre entier attendu.', -10),
  rooms: optionalInt('Nombre de pièces invalide.', 0),
  surface_m2: optionalNumber('Surface invalide : nombre positif attendu.', true),
  rent_amount: optionalNumber('Loyer invalide : nombre positif ou nul attendu.', false),
});

type FormValues = z.infer<typeof schema>;

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
          <DialogTitle>{unit ? 'Modifier l’unité ' + unit.code : 'Ajouter une unité'}</DialogTitle>
          <DialogDescription>
            {unit ? 'Corrigez les caractéristiques de l’unité.' : 'Appartement, bureau, commerce ou parking rattaché à ce bien.'}
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
        toast.success('Unité mise à jour', { description: values.code });
      } else {
        await graphql(ADD_UNIT, { object: { ...fields, property_id: propertyId } });
        toast.success('Unité créée', { description: values.code + ' a été ajoutée au bien.' });
      }
      onSaved();
    } catch (error) {
      toast.error('Enregistrement impossible', { description: toFrenchError(error, { unitCode: values.code }) });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <FieldGroup>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.code}>
            <FieldLabel htmlFor="unit-code">Référence *</FieldLabel>
            <Input
              id="unit-code"
              placeholder="Ex. B-101"
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
                <FieldLabel htmlFor="unit-type">Type *</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="unit-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_TYPES).map(([value, label]) => (
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
            <FieldLabel htmlFor="unit-floor">Étage</FieldLabel>
            <Input id="unit-floor" inputMode="numeric" placeholder="1" aria-invalid={!!errors.floor} {...register('floor')} />
            <FieldError errors={[errors.floor]} />
          </Field>
          <Field data-invalid={!!errors.rooms}>
            <FieldLabel htmlFor="unit-rooms">Pièces</FieldLabel>
            <Input id="unit-rooms" inputMode="numeric" placeholder="3" aria-invalid={!!errors.rooms} {...register('rooms')} />
            <FieldError errors={[errors.rooms]} />
          </Field>
          <Field data-invalid={!!errors.surface_m2}>
            <FieldLabel htmlFor="unit-surface">Surface</FieldLabel>
            <InputGroup>
              <InputGroupInput id="unit-surface" inputMode="decimal" placeholder="92" aria-invalid={!!errors.surface_m2} {...register('surface_m2')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>m²</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[errors.surface_m2]} />
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field data-invalid={!!errors.rent_amount}>
            <FieldLabel htmlFor="unit-rent">Loyer mensuel</FieldLabel>
            <InputGroup>
              <InputGroupInput id="unit-rent" inputMode="decimal" placeholder="980,000" aria-invalid={!!errors.rent_amount} {...register('rent_amount')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>TND</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldError errors={[errors.rent_amount]} />
          </Field>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="unit-status">Statut *</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="unit-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_STATUSES).map(([value, label]) => (
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
          Annuler
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
          {isSubmitting ? 'Enregistrement…' : unit ? 'Enregistrer' : 'Ajouter l’unité'}
        </Button>
      </DialogFooter>
    </form>
  );
}
