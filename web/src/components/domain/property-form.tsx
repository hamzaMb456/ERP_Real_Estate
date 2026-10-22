'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Loader2, Save } from '@/components/icons';
import { toast } from 'sonner';
import { z } from 'zod';
import { GOVERNORATES } from '@/components/domain/labels';
import { FieldLabelWithHelp } from '@/components/field-help';
import { LocationField } from '@/components/map/location-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
};

const orNull = (value: string) => (value === '' ? null : value);

type Props = { mode: 'create' } | { mode: 'edit'; propertyId: string; initial: PropertyFormValues };

export function PropertyForm(props: Props) {
  const t = useT();
  const schema = useMemo(() => makeSchema(t.properties.form), [t]);
  const router = useRouter();
  const editing = props.mode === 'edit';
  const cancelHref = props.mode === 'edit' ? '/biens/' + props.propertyId : '/biens';
  const branches = useGraphql<{ branches: { id: string; name: string; city: string | null }[] }>(BRANCHES_QUERY);
  const { control, register, handleSubmit, formState, setValue } = useForm<PropertyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: props.mode === 'edit' ? props.initial : EMPTY_PROPERTY,
  });
  const { errors, isSubmitting } = formState;
  const type = useWatch({ control, name: 'type' });
  const [addressLine, postalCode, city, governorate, latitude, longitude] = useWatch({
    control,
    name: ['address_line', 'postal_code', 'city', 'governorate', 'latitude', 'longitude'],
  });

  async function onSubmit(values: PropertyFormValues) {
    const fields = {
      name: values.name,
      branch_id: values.branch_id,
      address_line: orNull(values.address_line),
      city: orNull(values.city),
      governorate: orNull(values.governorate),
      postal_code: orNull(values.postal_code),
      latitude: values.latitude,
      longitude: values.longitude,
    };
    try {
      if (props.mode === 'edit') {
        await graphql(UPDATE_PROPERTY, { id: props.propertyId, set: fields });
        toast.success(t.properties.form.updated, { description: values.name });
        router.push('/biens/' + props.propertyId);
        return;
      }
      const created = await graphql<{ insert_properties_one: { id: string } }>(ADD_PROPERTY, {
        object: { ...fields, type: values.type },
      });
      toast.success(t.properties.form.created, {
        description:
          values.type === 'building'
            ? t.properties.form.createdBuilding(values.name)
            : t.properties.form.createdSingle(values.name),
      });
      router.push('/biens/' + created.insert_properties_one.id);
    } catch (error) {
      toast.error(t.properties.form.saveFailed, { description: toUserMessage(error) });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabelWithHelp htmlFor="name" help={t.properties.form.nameHelp}>
                {t.properties.form.name}
              </FieldLabelWithHelp>
              <Input
                id="name"
                placeholder={t.properties.form.namePlaceholder}
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
                {...register('name')}
              />
              <FieldError id="name-error" errors={[errors.name]} />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Field>
                    <FieldLabelWithHelp
                      htmlFor="type"
                      help={t.properties.form.typeHelp}
                    >
                      {t.properties.form.type}
                    </FieldLabelWithHelp>
                    <Select value={field.value} onValueChange={field.onChange} disabled={editing}>
                      <SelectTrigger id="type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(t.labels.propertyTypes).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editing ? (
                      <FieldDescription>{t.properties.form.typeLocked}</FieldDescription>
                    ) : (
                      type !== 'building' && (
                        <FieldDescription>
                          {t.properties.form.autoUnit(type === 'house' ? 'MAISON' : 'TERRAIN')}
                        </FieldDescription>
                      )
                    )}
                  </Field>
                )}
              />
              <Controller
                control={control}
                name="branch_id"
                render={({ field }) => (
                  <Field data-invalid={!!errors.branch_id}>
                    <FieldLabelWithHelp htmlFor="branch_id" help={t.properties.form.branchHelp}>
                      {t.properties.form.branch}
                    </FieldLabelWithHelp>
                    <Select value={field.value} onValueChange={field.onChange} disabled={branches.status !== 'success'}>
                      <SelectTrigger id="branch_id" className="w-full" aria-invalid={!!errors.branch_id}>
                        <SelectValue placeholder={branches.status === 'loading' ? t.common.loading : t.properties.form.branchPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.status === 'success' &&
                          branches.data.branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                              {branch.city ? ' · ' + branch.city : ''}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {branches.status === 'error' && (
                      <FieldDescription className="text-destructive">{t.properties.form.branchesError}</FieldDescription>
                    )}
                    <FieldError errors={[errors.branch_id]} />
                  </Field>
                )}
              />
            </div>

            <Field>
              <FieldLabelWithHelp htmlFor="address_line" help={t.properties.form.addressHelp}>
                {t.properties.form.address}
              </FieldLabelWithHelp>
              <Input id="address_line" placeholder={t.properties.form.addressPlaceholder} {...register('address_line')} />
            </Field>

            <div className="grid gap-6 sm:grid-cols-3">
              <Field>
                <FieldLabelWithHelp htmlFor="city" help={t.properties.form.cityHelp}>
                  {t.properties.form.city}
                </FieldLabelWithHelp>
                <Input id="city" placeholder={t.properties.form.cityPlaceholder} {...register('city')} />
              </Field>
              <Controller
                control={control}
                name="governorate"
                render={({ field }) => (
                  <Field>
                    <FieldLabelWithHelp htmlFor="governorate" help={t.properties.form.governorateHelp}>
                      {t.properties.form.governorate}
                    </FieldLabelWithHelp>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="governorate" className="w-full">
                        <SelectValue placeholder={t.properties.form.governoratePlaceholder} />
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
              <Field data-invalid={!!errors.postal_code}>
                <FieldLabelWithHelp htmlFor="postal_code" help={t.properties.form.postalCodeHelp}>
                  {t.properties.form.postalCode}
                </FieldLabelWithHelp>
                <Input
                  id="postal_code"
                  inputMode="numeric"
                  placeholder="2016"
                  aria-invalid={!!errors.postal_code}
                  aria-describedby={errors.postal_code ? 'postal_code-error' : undefined}
                  {...register('postal_code')}
                />
                <FieldError id="postal_code-error" errors={[errors.postal_code]} />
              </Field>
            </div>

            <Field>
              <FieldLabelWithHelp help={t.properties.form.positionHelp}>
                {t.properties.form.position}
              </FieldLabelWithHelp>
              <LocationField
                query={addressQuery([addressLine, postalCode, city, governorate])}
                latitude={latitude}
                longitude={longitude}
                onChange={(position) => {
                  setValue('latitude', position?.lat ?? null, { shouldDirty: true });
                  setValue('longitude', position?.lon ?? null, { shouldDirty: true });
                }}
              />
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button asChild variant="ghost">
            <Link href={cancelHref}>{t.common.cancel}</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            {isSubmitting ? t.common.saving : editing ? t.common.saveChanges : t.properties.form.saveProperty}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
