'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { GOVERNORATES } from '@/components/domain/labels';
import { FieldLabelWithHelp } from '@/components/field-help';
import { PendingPhotos, uploadPendingPhotos } from '@/components/files/pending-photos';
import { ChoiceChips, QuestionFlow, type FlowStep } from '@/components/forms/question-flow';
import { LocationField } from '@/components/map/location-field';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toUserMessage } from '@/lib/errors';
import { addressQuery } from '@/lib/geocode';
import { graphql } from '@/lib/graphql';
import { useGraphql } from '@/lib/use-graphql';

import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/provider';
const BRANCHES_QUERY = `query Branches { branches(order_by: { name: asc }) { id name city } }`;

const ADD_PROPERTY = `
  mutation AddProperty($object: properties_insert_input!) {
    insert_properties_one(object: $object) { id }
  }
`;

const UPDATE_PROPERTY = `
  mutation UpdateProperty($id: uuid!, $set: properties_set_input!) {
    update_properties_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

function makeSchema(m: Messages['properties']['form']) {
  return z.object({
  name: z.string().trim().min(2, m.nameRequired),
  type: z.enum(['building', 'house', 'plot']),
  branch_id: z.string().min(1, m.branchRequired),
  address_line: z.string().trim(),
  city: z.string().trim(),
  governorate: z.string(),
  postal_code: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{4}$/.test(value), m.postalInvalid),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  year_built: z
    .string()
    .trim()
    .refine((value) => value === '' || (/^\d{4}$/.test(value) && Number(value) >= 1800 && Number(value) <= 2100), m.yearBuiltInvalid),
  floors_count: z
    .string()
    .trim()
    .refine((value) => value === '' || (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= 200), m.floorsCountInvalid),
  neighbourhood_description: z.string().trim(),
  });
}

export type PropertyFormValues = z.infer<ReturnType<typeof makeSchema>>;

const EMPTY_PROPERTY: PropertyFormValues = {
  name: '',
  type: 'building',
  branch_id: '',
  address_line: '',
  city: '',
  governorate: '',
  postal_code: '',
  latitude: null,
  longitude: null,
  year_built: '',
  floors_count: '',
  neighbourhood_description: '',
};

const orNull = (value: string) => (value === '' ? null : value);

type Props = { mode: 'create' } | { mode: 'edit'; propertyId: string; initial: PropertyFormValues };

export function PropertyForm(props: Props) {
  const t = useT();
  const f = t.properties.form;
  const q = t.properties.flow.property;
  const schema = useMemo(() => makeSchema(f), [f]);
  const router = useRouter();
  const editing = props.mode === 'edit';
  // Optional photos of the bien (create mode only): uploaded once the bien exists. ERP only, never on the public site.
  const [photos, setPhotos] = useState<File[]>([]);
  const cancelHref = props.mode === 'edit' ? '/erp/biens/' + props.propertyId : '/erp/biens';
  const branches = useGraphql<{ branches: { id: string; name: string; city: string | null }[] }>(BRANCHES_QUERY);
  const { control, register, handleSubmit, formState, setValue, trigger } = useForm<PropertyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: props.mode === 'edit' ? props.initial : EMPTY_PROPERTY,
  });
  const { errors, isSubmitting } = formState;
  const type = useWatch({ control, name: 'type' });
  const [addressLine, postalCode, city, governorate, latitude, longitude] = useWatch({
    control,
    name: ['address_line', 'postal_code', 'city', 'governorate', 'latitude', 'longitude'],
  });

  async function onValid(values: PropertyFormValues) {
    const fields = {
      name: values.name,
      branch_id: values.branch_id,
      address_line: orNull(values.address_line),
      city: orNull(values.city),
      governorate: orNull(values.governorate),
      postal_code: orNull(values.postal_code),
      latitude: values.latitude,
      longitude: values.longitude,
      year_built: values.year_built === '' ? null : Number(values.year_built),
      floors_count: values.floors_count === '' ? null : Number(values.floors_count),
      neighbourhood_description: orNull(values.neighbourhood_description),
    };
    try {
      if (props.mode === 'edit') {
        await graphql(UPDATE_PROPERTY, { id: props.propertyId, set: fields });
        toast.success(f.updated, { description: values.name });
        router.push('/erp/biens/' + props.propertyId);
        return;
      }
      const created = await graphql<{ insert_properties_one: { id: string } }>(ADD_PROPERTY, {
        object: { ...fields, type: values.type },
      });
      if (photos.length > 0) {
        const failed = await uploadPendingPhotos({ propertyId: created.insert_properties_one.id }, photos);
        if (failed > 0) toast.error(f.saveFailed, { description: f.photosUploadFailed(failed, photos.length) });
      }
      toast.success(f.created, {
        description: values.type === 'building' ? f.createdBuilding(values.name) : f.createdSingle(values.name),
      });
      router.push('/erp/biens/' + created.insert_properties_one.id);
    } catch (error) {
      toast.error(f.saveFailed, { description: toUserMessage(error) });
    }
  }

  const checkFields = (names?: string[]) => trigger(names as FieldPath<PropertyFormValues>[] | undefined);
  const typeOptions = Object.entries(t.labels.propertyTypes).map(([value, label]) => ({ value, label }));

  const steps: FlowStep[] = [
    {
      id: 'name',
      title: q.name,
      help: f.nameHelp,
      fields: ['name'],
      children: (
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">{f.name}</FieldLabel>
          <Input id="name" placeholder={f.namePlaceholder} aria-invalid={!!errors.name} {...register('name')} />
          <FieldError id="name-error" errors={[errors.name]} />
        </Field>
      ),
    },
  ];
  if (!editing) {
    steps.push({
      id: 'type',
      title: q.type,
      help: f.typeHelp,
      fields: ['type'],
      children: (
        <div className="space-y-3">
          <Controller
            control={control}
            name="type"
            render={({ field }) => <ChoiceChips label={f.type} value={field.value} options={typeOptions} onChange={field.onChange} />}
          />
          {type !== 'building' && <p className="text-sm text-muted-foreground">{f.autoUnit(type === 'house' ? f.autoUnitHouse : f.autoUnitLand)}</p>}
        </div>
      ),
    });
  }
  steps.push(
    {
      id: 'branch',
      title: q.branch,
      help: f.branchHelp,
      fields: ['branch_id'],
      children: (
        <Field data-invalid={!!errors.branch_id}>
          {branches.status === 'loading' && <p className="text-sm text-muted-foreground">{t.common.loading}</p>}
          {branches.status === 'error' && <p className="text-sm text-destructive">{f.branchesError}</p>}
          {branches.status === 'success' && (
            <Controller
              control={control}
              name="branch_id"
              render={({ field }) => (
                <ChoiceChips
                  label={f.branch}
                  value={field.value}
                  options={branches.data.branches.map((branch) => ({ value: branch.id, label: branch.name + (branch.city ? ' · ' + branch.city : '') }))}
                  onChange={field.onChange}
                />
              )}
            />
          )}
          <FieldError errors={[errors.branch_id]} />
        </Field>
      ),
    },
    {
      id: 'address',
      title: q.address,
      help: q.addressHelp,
      fields: ['postal_code'],
      optional: true,
      children: (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Field>
            <FieldLabelWithHelp htmlFor="address_line" help={f.addressHelp}>
              {f.address}
            </FieldLabelWithHelp>
            <Input id="address_line" placeholder={f.addressPlaceholder} {...register('address_line')} />
          </Field>
          <Field data-invalid={!!errors.postal_code}>
            <FieldLabelWithHelp htmlFor="postal_code" help={f.postalCodeHelp}>
              {f.postalCode}
            </FieldLabelWithHelp>
            <Input id="postal_code" inputMode="numeric" placeholder="2016" aria-invalid={!!errors.postal_code} {...register('postal_code')} />
            <FieldError id="postal_code-error" errors={[errors.postal_code]} />
          </Field>
        </div>
      ),
    },
    {
      id: 'place',
      title: q.place,
      help: q.placeHelp,
      optional: true,
      children: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabelWithHelp htmlFor="city" help={f.cityHelp}>
              {f.city}
            </FieldLabelWithHelp>
            <Input id="city" placeholder={f.cityPlaceholder} {...register('city')} />
          </Field>
          <Controller
            control={control}
            name="governorate"
            render={({ field }) => (
              <Field>
                <FieldLabelWithHelp htmlFor="governorate" help={f.governorateHelp}>
                  {f.governorate}
                </FieldLabelWithHelp>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="governorate" className="w-full">
                    <SelectValue placeholder={f.governoratePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {GOVERNORATES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {t.labels.governorates[name] ?? name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        </div>
      ),
    },
    {
      id: 'position',
      title: q.position,
      help: f.positionHelp,
      optional: true,
      children: (
        <LocationField
          query={addressQuery([addressLine, postalCode, city, governorate])}
          latitude={latitude}
          longitude={longitude}
          onChange={(position) => {
            setValue('latitude', position?.lat ?? null, { shouldDirty: true });
            setValue('longitude', position?.lon ?? null, { shouldDirty: true });
          }}
        />
      ),
    },
    {
      id: 'building',
      title: q.building,
      help: q.buildingHelp,
      fields: ['year_built', 'floors_count'],
      optional: true,
      children: (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.year_built}>
            <FieldLabelWithHelp htmlFor="year_built" help={f.yearBuiltHelp}>
              {f.yearBuilt}
            </FieldLabelWithHelp>
            <Input id="year_built" inputMode="numeric" placeholder="2018" aria-invalid={!!errors.year_built} {...register('year_built')} />
            <FieldError errors={[errors.year_built]} />
          </Field>
          {type === 'building' && (
            <Field data-invalid={!!errors.floors_count}>
              <FieldLabelWithHelp htmlFor="floors_count" help={f.floorsCountHelp}>
                {f.floorsCount}
              </FieldLabelWithHelp>
              <Input id="floors_count" inputMode="numeric" placeholder="6" aria-invalid={!!errors.floors_count} {...register('floors_count')} />
              <FieldError errors={[errors.floors_count]} />
            </Field>
          )}
        </div>
      ),
    },
    {
      id: 'neighbourhood',
      title: q.neighbourhood,
      help: f.neighbourhoodHelp,
      optional: true,
      children: (
        <Field>
          <FieldLabel htmlFor="neighbourhood_description">{f.neighbourhood}</FieldLabel>
          <Textarea id="neighbourhood_description" rows={4} placeholder={f.neighbourhoodPlaceholder} {...register('neighbourhood_description')} />
        </Field>
      ),
    },
  );
  if (!editing) {
    steps.push({
      id: 'photos',
      title: q.photos,
      help: f.photosHelp,
      optional: true,
      children: <PendingPhotos files={photos} onChange={setPhotos} />,
    });
  }

  return (
    <Card>
      <CardContent>
        <QuestionFlow
          steps={steps}
          trigger={checkFields}
          onSubmit={handleSubmit(onValid)}
          onCancel={() => router.push(cancelHref)}
          submitting={isSubmitting}
          submitLabel={editing ? t.common.saveChanges : f.saveProperty}
        />
      </CardContent>
    </Card>
  );
}
