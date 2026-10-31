'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type FieldError as FieldErrorType, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { FieldHelp, FieldLabelWithHelp } from '@/components/field-help';
import { PhotoGallery } from '@/components/files/photo-gallery';
import { PendingPhotos, uploadPendingPhotos } from '@/components/files/pending-photos';
import { ChoiceChips, MultiChips, QuestionFlow, type FlowStep } from '@/components/forms/question-flow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { Textarea } from '@/components/ui/textarea';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { AMENITIES, CONDITIONS, ENERGY_CLASSES, INCLUDED_CHARGES, LEGAL_STATUSES, ORIENTATIONS } from '@/lib/website';

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

const intBetween = (label: string, min: number, max: number, optional: boolean) =>
  z
    .string()
    .trim()
    .refine((value) => (optional && value === '') || (/^\d+$/.test(value) && Number(value) >= min && Number(value) <= max), label);

// « none » stands for "not specified" in the selects (Radix items cannot carry an empty value) and is saved as null.
const NONE = 'none';
const orNone = <T extends string>(values: readonly T[]) => z.enum([NONE, ...values] as [string, ...string[]]);

function makeSchema(m: Messages['properties']['unitForm']) {
  return z.object({
  code: z.string().trim().min(1, m.codeRequired),
  type: z.enum(['apartment', 'office', 'shop', 'parking', 'house', 'land']),
  status: z.enum(['vacant', 'rented', 'for_sale', 'sold', 'under_maintenance']),
  floor: optionalInt(m.floorInvalid, -10),
  rooms: optionalInt(m.roomsInvalid, 0),
  surface_m2: optionalNumber(m.surfaceInvalid, true),
  rent_amount: optionalNumber(m.rentInvalid, false),
  title: z.string().trim(),
  description: z.string().trim(),
  sale_price: optionalNumber(m.salePriceInvalid, true),
  charges: optionalNumber(m.chargesInvalid, false),
  available_from: z.string(),
  furnished: z.boolean(),
  amenities: z.array(z.enum(AMENITIES)),
  show_on_website: z.boolean(),
  bedrooms: intBetween(m.countInvalid, 0, 50, true),
  bathrooms: intBetween(m.countInvalid, 0, 50, true),
  parking_spaces: intBetween(m.countInvalid, 0, 50, true),
  property_condition: orNone(CONDITIONS),
  orientation: z.array(z.enum(ORIENTATIONS)),
  balcony_m2: optionalNumber(m.outdoorAreaInvalid, true),
  terrace_m2: optionalNumber(m.outdoorAreaInvalid, true),
  garden_m2: optionalNumber(m.outdoorAreaInvalid, true),
  energy_class: orNone(ENERGY_CLASSES),
  deposit_months: intBetween(m.depositMonthsInvalid, 0, 12, false),
  min_lease_months: intBetween(m.minLeaseInvalid, 1, 120, true),
  pets: z.enum(['unspecified', 'allowed', 'forbidden']),
  charges_included: z.array(z.enum(INCLUDED_CHARGES)),
  legal_status: orNone(LEGAL_STATUSES),
  reservation_deposit: optionalNumber(m.reservationDepositInvalid, false).refine((value) => value !== '', m.reservationDepositInvalid),
  reservation_days: intBetween(m.reservationDaysInvalid, 1, 90, false),
  virtual_tour_url: z.string().trim().refine((value) => value === '' || /^https?:\/\//i.test(value), m.virtualTourInvalid),
  visit_fee: optionalNumber(m.visitFeeInvalid, false),
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
  title: string | null;
  description: string | null;
  sale_price: number | string | null;
  charges: number | string | null;
  available_from: string | null;
  furnished: boolean;
  amenities: string[];
  show_on_website: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  property_condition: string | null;
  orientation: string[];
  balcony_m2: number | string | null;
  terrace_m2: number | string | null;
  garden_m2: number | string | null;
  energy_class: string | null;
  deposit_months: number;
  min_lease_months: number | null;
  pets_allowed: boolean | null;
  charges_included: string[];
  legal_status: string | null;
  reservation_deposit: number | string;
  reservation_days: number;
  virtual_tour_url: string | null;
  visit_fee: number | string | null;
};

// A new unit goes on the website by itself (show_on_website defaults to true in the database too).
const EMPTY: FormValues = {
  code: '',
  type: 'apartment',
  status: 'vacant',
  floor: '',
  rooms: '',
  surface_m2: '',
  rent_amount: '',
  title: '',
  description: '',
  sale_price: '',
  charges: '',
  available_from: '',
  furnished: false,
  amenities: [],
  show_on_website: true,
  bedrooms: '',
  bathrooms: '',
  parking_spaces: '',
  property_condition: NONE,
  orientation: [],
  balcony_m2: '',
  terrace_m2: '',
  garden_m2: '',
  energy_class: NONE,
  deposit_months: '2',
  min_lease_months: '',
  pets: 'unspecified',
  charges_included: [],
  legal_status: NONE,
  reservation_deposit: '10000',
  reservation_days: '15',
  virtual_tour_url: '',
  visit_fee: '',
};

const asText = (value: number | string | null) => (value === null ? '' : String(value));
const toNumberOrNull = (value: string) => (value === '' ? null : Number(value.replace(',', '.')));
const toTextOrNull = (value: string) => (value === '' ? null : value);

function toFormValues(unit: UnitFormUnit): FormValues {
  return {
    code: unit.code,
    type: unit.type as FormValues['type'],
    status: unit.status as FormValues['status'],
    floor: asText(unit.floor),
    rooms: asText(unit.rooms),
    surface_m2: asText(unit.surface_m2),
    rent_amount: asText(unit.rent_amount),
    title: unit.title ?? '',
    description: unit.description ?? '',
    sale_price: asText(unit.sale_price),
    charges: asText(unit.charges),
    available_from: unit.available_from ?? '',
    furnished: unit.furnished,
    amenities: unit.amenities.filter((value): value is FormValues['amenities'][number] => (AMENITIES as readonly string[]).includes(value)),
    show_on_website: unit.show_on_website,
    bedrooms: asText(unit.bedrooms),
    bathrooms: asText(unit.bathrooms),
    parking_spaces: asText(unit.parking_spaces),
    property_condition: unit.property_condition ?? NONE,
    orientation: unit.orientation.filter((value): value is FormValues['orientation'][number] => (ORIENTATIONS as readonly string[]).includes(value)),
    balcony_m2: asText(unit.balcony_m2),
    terrace_m2: asText(unit.terrace_m2),
    garden_m2: asText(unit.garden_m2),
    energy_class: unit.energy_class ?? NONE,
    deposit_months: String(unit.deposit_months),
    min_lease_months: asText(unit.min_lease_months),
    pets: unit.pets_allowed === null ? 'unspecified' : unit.pets_allowed ? 'allowed' : 'forbidden',
    charges_included: unit.charges_included.filter((value): value is FormValues['charges_included'][number] =>
      (INCLUDED_CHARGES as readonly string[]).includes(value),
    ),
    legal_status: unit.legal_status ?? NONE,
    reservation_deposit: String(Number(unit.reservation_deposit)),
    reservation_days: String(unit.reservation_days),
    virtual_tour_url: unit.virtual_tour_url ?? '',
    visit_fee: asText(unit.visit_fee),
  };
}

export type PropertyOption = { id: string; name: string };

/** Unit types that only exist as the single unit of a house or a plot, never inside a building. */
const STANDALONE_UNIT_TYPES = new Set(['house', 'land']);

type Props = {
  /** The bien the unit is added to. Omit it (with `propertyOptions`) to let the admin choose the bien in the form. */
  propertyId?: string;
  propertyOptions?: PropertyOption[];
  unit?: UnitFormUnit;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
};

export function UnitDialog({ propertyId, propertyOptions, unit, trigger, open, onOpenChange, onSaved }: Props) {
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
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{unit ? t.properties.unitForm.editTitle(unit.code) : t.properties.unitForm.addTitle}</DialogTitle>
          <DialogDescription>
            {unit ? t.properties.unitForm.editDescription : t.properties.unitForm.addDescription}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from fresh values. */}
        <UnitForm
          propertyId={propertyId}
          propertyOptions={propertyOptions}
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

/** Not a react-hook-form field: the building is picked outside the schema, so it has its own check. */
const PROPERTY_STEP_FIELD = '__property';

/** A labelled field with its error; the label carries a help bubble when there is help text. */
function QuestionField({ id, label, help, error, children }: { id: string; label: string; help?: string; error?: FieldErrorType; children: ReactNode }) {
  return (
    <Field data-invalid={!!error}>
      {help ? (
        <FieldLabelWithHelp htmlFor={id} help={help}>
          {label}
        </FieldLabelWithHelp>
      ) : (
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
      )}
      {children}
      <FieldError errors={[error]} />
    </Field>
  );
}

function UnitForm({
  propertyId,
  propertyOptions,
  unit,
  onCancel,
  onSaved,
}: {
  propertyId?: string;
  propertyOptions?: PropertyOption[];
  unit?: UnitFormUnit;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const f = t.properties.unitForm;
  const q = t.properties.flow.unit;
  const schema = useMemo(() => makeSchema(f), [f]);
  const { control, register, handleSubmit, formState, trigger } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: unit ? toFormValues(unit) : EMPTY,
  });
  const { errors, isSubmitting } = formState;
  const status = useWatch({ control, name: 'status' });
  const forSale = status === 'for_sale';
  const [chosenProperty, setChosenProperty] = useState('');
  const [propertyMissing, setPropertyMissing] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const targetProperty = propertyId ?? chosenProperty;
  const picking = !unit && propertyId === undefined && propertyOptions !== undefined;

  async function checkFields(names?: string[]) {
    const formFields = names?.filter((name) => name !== PROPERTY_STEP_FIELD);
    const valid = names === undefined || (formFields && formFields.length > 0) ? await trigger(formFields as FieldPath<FormValues>[] | undefined) : true;
    if (names?.includes(PROPERTY_STEP_FIELD) && !unit && targetProperty === '') {
      setPropertyMissing(true);
      return false;
    }
    return valid;
  }

  async function onValid(values: FormValues) {
    const fields = toUnitFields(values);
    try {
      if (unit) {
        await graphql(UPDATE_UNIT, { id: unit.id, set: fields });
        toast.success(f.updated, { description: values.code });
      } else {
        const created = await graphql<{ insert_units_one: { id: string } }>(ADD_UNIT, { object: { ...fields, property_id: targetProperty } });
        toast.success(f.created, { description: f.createdBody(values.code) });
        if (photos.length > 0) {
          const failed = await uploadPendingPhotos({ unitId: created.insert_units_one.id }, photos);
          if (failed > 0) toast.error(t.properties.form.saveFailed, { description: q.photosUploadFailed(failed, photos.length) });
        }
      }
      onSaved();
    } catch (error) {
      toast.error(t.properties.form.saveFailed, { description: toUserMessage(error, { unitCode: values.code }) });
    }
  }

  const noneOption = { value: NONE, label: f.notSpecified };
  // A building holds apartments, offices, shops and parkings. House and land are properties of their own: their single
  // unit is created with the property, so it is only offered while editing a unit that already has that type.
  const unitTypeOptions = Object.entries(t.labels.unitTypes)
    .filter(([value]) => !STANDALONE_UNIT_TYPES.has(value) || value === unit?.type)
    .map(([value, label]) => ({ value, label }));
  const statusOptions = Object.entries(t.labels.unitStatuses).map(([value, label]) => ({ value, label }));

  const steps: FlowStep[] = [];
  if (picking && propertyOptions) {
    steps.push({
      id: 'building',
      title: q.building,
      help: t.units.propertyPicker.help,
      fields: [PROPERTY_STEP_FIELD],
      children: (
        <Field data-invalid={propertyMissing}>
          {propertyOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.units.propertyPicker.none}</p>
          ) : (
            <ChoiceChips
              label={t.units.propertyPicker.label}
              value={chosenProperty}
              options={propertyOptions.map((option) => ({ value: option.id, label: option.name }))}
              onChange={(value) => {
                setChosenProperty(value);
                setPropertyMissing(false);
              }}
            />
          )}
          {propertyMissing && <FieldError>{t.units.propertyPicker.required}</FieldError>}
        </Field>
      ),
    });
  }
  steps.push(
    {
      id: 'code',
      title: q.code,
      help: q.codeHelp,
      fields: ['code'],
      children: (
        <QuestionField id="unit-code" label={f.code} error={errors.code}>
          <Input id="unit-code" placeholder={f.codePlaceholder} aria-invalid={!!errors.code} {...register('code')} />
        </QuestionField>
      ),
    },
    {
      id: 'kind',
      title: q.kind,
      help: q.kindHelp,
      fields: ['type', 'status'],
      children: (
        <div className="space-y-5">
          <Controller control={control} name="type" render={({ field }) => <ChoiceChips label={f.type} value={field.value} options={unitTypeOptions} onChange={field.onChange} />} />
          <div className="space-y-2">
            <p className="text-sm font-medium">{f.status}</p>
            <Controller control={control} name="status" render={({ field }) => <ChoiceChips label={f.status} value={field.value} options={statusOptions} onChange={field.onChange} />} />
            {status === 'vacant' && <FieldHelp>{q.statusRentHelp}</FieldHelp>}
            {forSale && <FieldHelp>{q.statusSaleHelp}</FieldHelp>}
          </div>
        </div>
      ),
    },
    {
      id: 'size',
      title: q.size,
      help: q.sizeHelp,
      fields: ['surface_m2', 'rooms', 'floor'],
      optional: true,
      children: (
        <div className="grid gap-4 sm:grid-cols-3">
          <QuestionField id="unit-surface" label={f.surface} error={errors.surface_m2}>
            <InputGroup>
              <InputGroupInput id="unit-surface" inputMode="decimal" placeholder="92" aria-invalid={!!errors.surface_m2} {...register('surface_m2')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t.common.squareMeters}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </QuestionField>
          <QuestionField id="unit-rooms" label={f.rooms} help={f.roomsHelp} error={errors.rooms}>
            <Input id="unit-rooms" inputMode="numeric" placeholder="4" aria-invalid={!!errors.rooms} {...register('rooms')} />
          </QuestionField>
          <QuestionField id="unit-floor" label={f.floor} help={f.floorHelp} error={errors.floor}>
            <Input id="unit-floor" inputMode="numeric" placeholder="1" aria-invalid={!!errors.floor} {...register('floor')} />
          </QuestionField>
        </div>
      ),
    },
    {
      id: 'rooms',
      title: q.rooms,
      help: q.roomsHelp,
      fields: ['bedrooms', 'bathrooms', 'parking_spaces'],
      optional: true,
      children: (
        <div className="grid gap-4 sm:grid-cols-3">
          <QuestionField id="unit-bedrooms" label={f.bedrooms} help={f.bedroomsHelp} error={errors.bedrooms}>
            <Input id="unit-bedrooms" inputMode="numeric" placeholder="3" aria-invalid={!!errors.bedrooms} {...register('bedrooms')} />
          </QuestionField>
          <QuestionField id="unit-bathrooms" label={f.bathrooms} error={errors.bathrooms}>
            <Input id="unit-bathrooms" inputMode="numeric" placeholder="2" aria-invalid={!!errors.bathrooms} {...register('bathrooms')} />
          </QuestionField>
          <QuestionField id="unit-parking" label={f.parkingSpaces} error={errors.parking_spaces}>
            <Input id="unit-parking" inputMode="numeric" placeholder="1" aria-invalid={!!errors.parking_spaces} {...register('parking_spaces')} />
          </QuestionField>
        </div>
      ),
    },
  );

  if (forSale) {
    steps.push(
      {
        id: 'sale-price',
        title: q.salePrice,
        help: q.salePriceHelp,
        fields: ['sale_price'],
        children: (
          <QuestionField id="unit-sale-price" label={f.salePrice} help={f.salePriceHelp} error={errors.sale_price}>
            <InputGroup>
              <InputGroupInput id="unit-sale-price" inputMode="decimal" placeholder="350000" aria-invalid={!!errors.sale_price} {...register('sale_price')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t.common.currency}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </QuestionField>
        ),
      },
      {
        id: 'sale-terms',
        title: q.saleTerms,
        help: q.saleTermsHelp,
        fields: ['legal_status', 'reservation_deposit', 'reservation_days'],
        optional: true,
        children: (
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">{f.legalStatus}</p>
              <Controller
                control={control}
                name="legal_status"
                render={({ field }) => (
                  <ChoiceChips
                    label={f.legalStatus}
                    value={field.value}
                    options={[noneOption, ...LEGAL_STATUSES.map((value) => ({ value: value as string, label: t.listings.legalStatuses[value] }))]}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <QuestionField id="unit-reservation-deposit" label={f.reservationDeposit} help={f.reservationDepositHelp} error={errors.reservation_deposit}>
                <InputGroup>
                  <InputGroupInput id="unit-reservation-deposit" inputMode="decimal" aria-invalid={!!errors.reservation_deposit} {...register('reservation_deposit')} />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{t.common.currency}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </QuestionField>
              <QuestionField id="unit-reservation-days" label={f.reservationDays} error={errors.reservation_days}>
                <Input id="unit-reservation-days" inputMode="numeric" aria-invalid={!!errors.reservation_days} {...register('reservation_days')} />
              </QuestionField>
            </div>
          </div>
        ),
      },
    );
  } else {
    steps.push(
      {
        id: 'rent',
        title: q.rent,
        help: q.rentHelp,
        fields: ['rent_amount', 'charges'],
        children: (
          <div className="grid gap-4 sm:grid-cols-2">
            <QuestionField id="unit-rent" label={f.rent} help={f.rentHelp} error={errors.rent_amount}>
              <InputGroup>
                <InputGroupInput id="unit-rent" inputMode="decimal" placeholder="980,000" aria-invalid={!!errors.rent_amount} {...register('rent_amount')} />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{t.common.currency}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </QuestionField>
            <QuestionField id="unit-charges" label={f.charges} help={f.chargesHelp} error={errors.charges}>
              <InputGroup>
                <InputGroupInput id="unit-charges" inputMode="decimal" placeholder="60" aria-invalid={!!errors.charges} {...register('charges')} />
                <InputGroupAddon align="inline-end">
                  <InputGroupText>{t.common.currency}</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </QuestionField>
          </div>
        ),
      },
      {
        id: 'rent-terms',
        title: q.rentTerms,
        help: q.rentTermsHelp,
        fields: ['deposit_months', 'min_lease_months', 'visit_fee'],
        optional: true,
        children: (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <QuestionField id="unit-deposit" label={f.depositMonths} help={f.depositMonthsHelp} error={errors.deposit_months}>
                <Input id="unit-deposit" inputMode="numeric" aria-invalid={!!errors.deposit_months} {...register('deposit_months')} />
              </QuestionField>
              <QuestionField id="unit-min-lease" label={f.minLease} error={errors.min_lease_months}>
                <Input id="unit-min-lease" inputMode="numeric" placeholder="12" aria-invalid={!!errors.min_lease_months} {...register('min_lease_months')} />
              </QuestionField>
            </div>
          <QuestionField id="unit-visit-fee" label={f.visitFee} help={f.visitFeeHelp} error={errors.visit_fee}>
            <InputGroup className="sm:max-w-48">
              <InputGroupInput id="unit-visit-fee" inputMode="decimal" placeholder="0" aria-invalid={!!errors.visit_fee} {...register('visit_fee')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t.common.currency}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </QuestionField>
            <div className="space-y-2">
              <p className="text-sm font-medium">{f.pets}</p>
              <Controller
                control={control}
                name="pets"
                render={({ field }) => (
                  <ChoiceChips
                    label={f.pets}
                    value={field.value}
                    options={[
                      { value: 'unspecified', label: f.notSpecified },
                      { value: 'allowed', label: f.petsAllowed },
                      { value: 'forbidden', label: f.petsForbidden },
                    ]}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{f.chargesIncluded}</p>
              <Controller
                control={control}
                name="charges_included"
                render={({ field }) => (
                  <MultiChips
                    label={f.chargesIncluded}
                    value={field.value}
                    options={INCLUDED_CHARGES.map((value) => ({ value, label: t.listings.includedCharges[value] }))}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </div>
        ),
      },
    );
  }

  steps.push(
    {
      id: 'condition',
      title: q.condition,
      help: q.conditionHelp,
      optional: true,
      children: (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">{f.condition}</p>
            <Controller
              control={control}
              name="property_condition"
              render={({ field }) => (
                <ChoiceChips
                  label={f.condition}
                  value={field.value}
                  options={[noneOption, ...CONDITIONS.map((value) => ({ value: value as string, label: t.listings.conditions[value] }))]}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {f.energyClass}
              <FieldHelp>{f.energyClassHelp}</FieldHelp>
            </p>
            <Controller
              control={control}
              name="energy_class"
              render={({ field }) => (
                <ChoiceChips
                  label={f.energyClass}
                  value={field.value}
                  options={[noneOption, ...ENERGY_CLASSES.map((value) => ({ value: value as string, label: value }))]}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </div>
      ),
    },
    {
      id: 'outdoor',
      title: q.outdoor,
      help: q.outdoorHelp,
      fields: ['balcony_m2', 'terrace_m2', 'garden_m2'],
      optional: true,
      children: (
        <div className="space-y-5">
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {f.orientation}
              <FieldHelp>{f.orientationHelp}</FieldHelp>
            </p>
            <Controller
              control={control}
              name="orientation"
              render={({ field }) => (
                <MultiChips
                  label={f.orientation}
                  value={field.value}
                  options={ORIENTATIONS.map((value) => ({ value, label: t.listings.orientations[value] }))}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
          <QuestionField id="unit-balcony" label={f.balcony} help={f.balconyHelp} error={errors.balcony_m2}>
            <InputGroup className="sm:max-w-48">
              <InputGroupInput id="unit-balcony" inputMode="decimal" placeholder="6" aria-invalid={!!errors.balcony_m2} {...register('balcony_m2')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t.common.squareMeters}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </QuestionField>
          <QuestionField id="unit-terrace" label={f.terrace} help={f.terraceHelp} error={errors.terrace_m2}>
            <InputGroup className="sm:max-w-48">
              <InputGroupInput id="unit-terrace" inputMode="decimal" placeholder="20" aria-invalid={!!errors.terrace_m2} {...register('terrace_m2')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t.common.squareMeters}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </QuestionField>
          <QuestionField id="unit-garden" label={f.garden} help={f.gardenHelp} error={errors.garden_m2}>
            <InputGroup className="sm:max-w-48">
              <InputGroupInput id="unit-garden" inputMode="decimal" placeholder="50" aria-invalid={!!errors.garden_m2} {...register('garden_m2')} />
              <InputGroupAddon align="inline-end">
                <InputGroupText>{t.common.squareMeters}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </QuestionField>
        </div>
      ),
    },
    {
      id: 'amenities',
      title: q.amenities,
      help: q.amenitiesHelp,
      optional: true,
      children: (
        <div className="space-y-4">
          <Controller
            control={control}
            name="furnished"
            render={({ field }) => (
              <MultiChips
                label={f.furnished}
                value={field.value ? ['furnished'] : []}
                options={[{ value: 'furnished', label: f.furnished }]}
                onChange={(value) => field.onChange(value.length > 0)}
              />
            )}
          />
          <Controller
            control={control}
            name="amenities"
            render={({ field }) => (
              <MultiChips
                label={f.amenities}
                value={field.value}
                options={AMENITIES.map((value) => ({ value, label: t.listings.amenities[value] }))}
                onChange={field.onChange}
              />
            )}
          />
        </div>
      ),
    },
    {
      id: 'availability',
      title: q.availability,
      help: q.availabilityHelp,
      optional: true,
      children: (
        <QuestionField id="unit-available-from" label={f.availableFrom} error={errors.available_from}>
          <Input id="unit-available-from" type="date" className="sm:max-w-56" {...register('available_from')} />
        </QuestionField>
      ),
    },
    {
      id: 'texts',
      title: q.texts,
      help: q.textsHelp,
      fields: ['virtual_tour_url'],
      optional: true,
      children: (
        <div className="space-y-4">
          <QuestionField id="unit-title" label={f.websiteTitle} help={f.websiteTitleHelp} error={errors.title}>
            <Input id="unit-title" placeholder={f.websiteTitlePlaceholder} {...register('title')} />
          </QuestionField>
          <QuestionField id="unit-description" label={f.websiteDescription} error={errors.description}>
            <Textarea id="unit-description" rows={4} {...register('description')} />
          </QuestionField>
          <QuestionField id="unit-tour" label={f.virtualTour} help={f.virtualTourHelp} error={errors.virtual_tour_url}>
            <Input id="unit-tour" type="url" dir="ltr" inputMode="url" placeholder="https://" aria-invalid={!!errors.virtual_tour_url} {...register('virtual_tour_url')} />
          </QuestionField>
        </div>
      ),
    },
    {
      id: 'photos',
      title: q.photos,
      help: q.photosHelp,
      optional: true,
      children: unit ? (
        <PhotoGallery target={{ unitId: unit.id }} />
      ) : (
        <div className="space-y-2">
          <PendingPhotos files={photos} onChange={setPhotos} />
          {photos.length > 0 && <p className="text-xs text-muted-foreground">{q.photosAdded}</p>}
        </div>
      ),
    },
    {
      id: 'publish',
      title: q.publish,
      help: q.publishHelp,
      children: (
        <Controller
          control={control}
          name="show_on_website"
          render={({ field }) => (
            <div className="space-y-2">
              <MultiChips
                label={f.showOnWebsite}
                value={field.value ? ['show'] : []}
                options={[{ value: 'show', label: f.showOnWebsite }]}
                onChange={(value) => field.onChange(value.length > 0)}
              />
              <p className="text-xs text-muted-foreground">{f.showOnWebsiteHelp}</p>
            </div>
          )}
        />
      ),
    },
  );

  return (
    <QuestionFlow
      steps={steps}
      trigger={checkFields}
      onSubmit={handleSubmit(onValid)}
      onCancel={onCancel}
      submitting={isSubmitting}
      submitLabel={unit ? t.common.save : f.submitAdd}
    />
  );
}

/** The columns saved for a validated form (strings become numbers, « none » becomes null). */
function toUnitFields(values: FormValues) {
  return {
    code: values.code,
    type: values.type,
    status: values.status,
    floor: toNumberOrNull(values.floor),
    rooms: toNumberOrNull(values.rooms),
    surface_m2: toNumberOrNull(values.surface_m2),
    rent_amount: toNumberOrNull(values.rent_amount),
    title: toTextOrNull(values.title),
    description: toTextOrNull(values.description),
    sale_price: toNumberOrNull(values.sale_price),
    charges: toNumberOrNull(values.charges),
    available_from: toTextOrNull(values.available_from),
    furnished: values.furnished,
    amenities: AMENITIES.filter((amenity) => values.amenities.includes(amenity)),
    show_on_website: values.show_on_website,
    bedrooms: toNumberOrNull(values.bedrooms),
    bathrooms: toNumberOrNull(values.bathrooms),
    parking_spaces: toNumberOrNull(values.parking_spaces),
    property_condition: values.property_condition === NONE ? null : values.property_condition,
    orientation: ORIENTATIONS.filter((side) => values.orientation.includes(side)),
    balcony_m2: toNumberOrNull(values.balcony_m2),
    terrace_m2: toNumberOrNull(values.terrace_m2),
    garden_m2: toNumberOrNull(values.garden_m2),
    energy_class: values.energy_class === NONE ? null : values.energy_class,
    deposit_months: Number(values.deposit_months),
    min_lease_months: toNumberOrNull(values.min_lease_months),
    pets_allowed: values.pets === 'unspecified' ? null : values.pets === 'allowed',
    charges_included: INCLUDED_CHARGES.filter((charge) => values.charges_included.includes(charge)),
    legal_status: values.legal_status === NONE ? null : values.legal_status,
    reservation_deposit: toNumberOrNull(values.reservation_deposit),
    reservation_days: Number(values.reservation_days),
    virtual_tour_url: toTextOrNull(values.virtual_tour_url),
    visit_fee: toNumberOrNull(values.visit_fee),
  };
}
