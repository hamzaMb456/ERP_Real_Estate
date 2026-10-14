'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { GOVERNORATES, PROPERTY_TYPES } from '@/components/domain/labels';
import { LocationField } from '@/components/map/location-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toFrenchError } from '@/lib/errors';
import { addressQuery } from '@/lib/geocode';
import { graphql } from '@/lib/graphql';
import { useGraphql } from '@/lib/use-graphql';

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

const schema = z.object({
  name: z.string().trim().min(2, 'Saisissez le nom du bien (2 caractères minimum).'),
  type: z.enum(['building', 'house', 'plot']),
  branch_id: z.string().min(1, 'Choisissez la succursale responsable.'),
  address_line: z.string().trim(),
  city: z.string().trim(),
  governorate: z.string(),
  postal_code: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{4}$/.test(value), 'Code postal invalide : 4 chiffres attendus.'),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
});

export type PropertyFormValues = z.infer<typeof schema>;

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
        toast.success('Bien mis à jour', { description: values.name });
        router.push('/biens/' + props.propertyId);
        return;
      }
      const created = await graphql<{ insert_properties_one: { id: string } }>(ADD_PROPERTY, {
        object: { ...fields, type: values.type },
      });
      toast.success('Bien créé', {
        description:
          values.type === 'building'
            ? values.name + ' a été ajouté. Ajoutez maintenant ses unités.'
            : values.name + ' a été ajouté avec son unité.',
      });
      router.push('/biens/' + created.insert_properties_one.id);
    } catch (error) {
      toast.error('Enregistrement impossible', { description: toFrenchError(error) });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="name">Nom du bien *</FieldLabel>
              <Input
                id="name"
                placeholder="Ex. Résidence Les Jardins de Carthage"
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
                    <FieldLabel htmlFor="type">Type de bien *</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={editing}>
                      <SelectTrigger id="type" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PROPERTY_TYPES).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {editing ? (
                      <FieldDescription>Le type ne peut plus être modifié après la création.</FieldDescription>
                    ) : (
                      type !== 'building' && (
                        <FieldDescription>
                          Une unité « {type === 'house' ? 'MAISON' : 'TERRAIN'} » sera créée automatiquement pour suivre
                          propriétaires, loyers et ventes.
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
                    <FieldLabel htmlFor="branch_id">Succursale *</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={branches.status !== 'success'}>
                      <SelectTrigger id="branch_id" className="w-full" aria-invalid={!!errors.branch_id}>
                        <SelectValue placeholder={branches.status === 'loading' ? 'Chargement…' : 'Choisir une succursale'} />
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
                      <FieldDescription className="text-destructive">Impossible de charger les succursales.</FieldDescription>
                    )}
                    <FieldError errors={[errors.branch_id]} />
                  </Field>
                )}
              />
            </div>

            <Field>
              <FieldLabel htmlFor="address_line">Adresse</FieldLabel>
              <Input id="address_line" placeholder="Ex. 14 Rue des Jardins" {...register('address_line')} />
            </Field>

            <div className="grid gap-6 sm:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="city">Ville</FieldLabel>
                <Input id="city" placeholder="Ex. Carthage" {...register('city')} />
              </Field>
              <Controller
                control={control}
                name="governorate"
                render={({ field }) => (
                  <Field>
                    <FieldLabel htmlFor="governorate">Gouvernorat</FieldLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="governorate" className="w-full">
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        {GOVERNORATES.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              />
              <Field data-invalid={!!errors.postal_code}>
                <FieldLabel htmlFor="postal_code">Code postal</FieldLabel>
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
              <FieldLabel>Position sur la carte</FieldLabel>
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
            <Link href={cancelHref}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
            {isSubmitting ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Enregistrer le bien'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
