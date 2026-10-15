'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Building2, Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { CONTACT_ROLES, type ContactRole } from '@/components/domain/badges';
import { DuplicateNotice } from '@/components/domain/duplicate-notice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  duplicateWhere,
  findDuplicates,
  formatTnPhone,
  normalizePhone,
  type DuplicateCandidate,
  type DuplicateMatch,
} from '@/lib/contact-duplicates';
import { toFrenchError } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { cn } from '@/lib/utils';

const ADD_CONTACT = `
  mutation AddContact($object: contacts_insert_input!) {
    insert_contacts_one(object: $object) { id }
  }
`;

const ADD_ROLES = `
  mutation AddContactRoles($objects: [contact_roles_insert_input!]!) {
    insert_contact_roles(objects: $objects) { affected_rows }
  }
`;

const UPDATE_CONTACT = `
  mutation UpdateContact($id: uuid!, $set: contacts_set_input!, $removed: [String!]!, $added: [contact_roles_insert_input!]!) {
    update_contacts_by_pk(pk_columns: { id: $id }, _set: $set) { id }
    delete_contact_roles(where: { contact_id: { _eq: $id }, role: { _in: $removed } }) { affected_rows }
    insert_contact_roles(objects: $added) { affected_rows }
  }
`;

const DUPLICATES_QUERY = `
  query ContactDuplicates($where: contacts_bool_exp!) {
    contacts(where: $where, limit: 10) { id full_name national_id email phone }
  }
`;

const schema = z.object({
  kind: z.enum(['person', 'company']),
  full_name: z.string().trim().min(2, 'Saisissez le nom complet (2 caractères minimum).'),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || normalizePhone(value).length === 8, 'Numéro invalide : 8 chiffres attendus (ex. 98 123 456).'),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Adresse e-mail invalide.'),
  national_id: z.string().trim(),
  address: z.string().trim(),
  notes: z.string().trim(),
  roles: z.array(z.enum(['owner', 'renter', 'buyer'])).min(1, 'Choisissez au moins un rôle.'),
});

export type ContactFormValues = z.infer<typeof schema>;

const EMPTY: ContactFormValues = {
  kind: 'person',
  full_name: '',
  phone: '',
  email: '',
  national_id: '',
  address: '',
  notes: '',
  roles: [],
};

const orNull = (value: string) => (value === '' ? null : value);

/** Stored phones look like "+216 98 123 456"; the form shows the 8 local digits. */
export function phoneForForm(stored: string | null): string {
  return stored ? formatTnPhone(normalizePhone(stored)) : '';
}

type Props =
  | { mode: 'create' }
  | { mode: 'edit'; contactId: string; initial: ContactFormValues; lockedRoles: ContactRole[] };

export function ContactForm(props: Props) {
  const router = useRouter();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const editing = props.mode === 'edit';
  const lockedRoles = props.mode === 'edit' ? props.lockedRoles : [];
  const { control, register, handleSubmit, formState, getValues } = useForm<ContactFormValues>({
    resolver: zodResolver(schema),
    defaultValues: props.mode === 'edit' ? props.initial : EMPTY,
  });
  const { errors, isSubmitting } = formState;

  async function checkDuplicates() {
    const input = { national_id: getValues('national_id'), email: getValues('email'), phone: getValues('phone') };
    const where = duplicateWhere(input);
    if (!where) {
      setDuplicates([]);
      return;
    }
    try {
      const data = await graphql<{ contacts: DuplicateCandidate[] }>(DUPLICATES_QUERY, { where });
      setDuplicates(findDuplicates(input, data.contacts, props.mode === 'edit' ? props.contactId : undefined));
    } catch {
      setDuplicates([]); // The warning is a help, never a blocker.
    }
  }

  async function onSubmit(values: ContactFormValues) {
    const fields = {
      kind: values.kind,
      full_name: values.full_name,
      email: orNull(values.email),
      phone: values.phone === '' ? null : '+216 ' + formatTnPhone(normalizePhone(values.phone)),
      national_id: orNull(values.national_id),
      address: orNull(values.address),
      notes: orNull(values.notes),
    };
    try {
      if (props.mode === 'edit') {
        const before = props.initial.roles;
        await graphql(UPDATE_CONTACT, {
          id: props.contactId,
          set: fields,
          removed: before.filter((role) => !values.roles.includes(role)),
          added: values.roles.filter((role) => !before.includes(role)).map((role) => ({ contact_id: props.contactId, role })),
        });
        toast.success('Contact mis à jour', { description: values.full_name });
        router.push('/contacts/' + props.contactId);
        return;
      }
      // Keep the id across retries so a failed role insert never creates a second contact.
      let contactId = createdId;
      if (contactId === null) {
        const created = await graphql<{ insert_contacts_one: { id: string } }>(ADD_CONTACT, { object: fields });
        contactId = created.insert_contacts_one.id;
        setCreatedId(contactId);
      }
      await graphql(ADD_ROLES, { objects: values.roles.map((role) => ({ contact_id: contactId, role })) });
      toast.success('Contact créé', { description: values.full_name + ' a été ajouté.' });
      router.push('/contacts/' + contactId);
    } catch (error) {
      toast.error('Enregistrement impossible', { description: toFrenchError(error) });
    }
  }

  const cancelHref = props.mode === 'edit' ? '/contacts/' + props.contactId : '/contacts';

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent>
          <FieldGroup>
            <Controller
              control={control}
              name="kind"
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">Type de contact</FieldLegend>
                  <RadioGroup value={field.value} onValueChange={field.onChange} className="grid max-w-md grid-cols-2 gap-3">
                    {(
                      [
                        { value: 'person', label: 'Personne', icon: User },
                        { value: 'company', label: 'Société', icon: Building2 },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const selected = field.value === option.value;
                      return (
                        <label
                          key={option.value}
                          htmlFor={'kind-' + option.value}
                          className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm font-medium transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                            selected ? 'border-primary bg-accent text-accent-foreground' : 'hover:bg-muted',
                          )}
                        >
                          <RadioGroupItem id={'kind-' + option.value} value={option.value} />
                          <Icon className="size-4" aria-hidden />
                          {option.label}
                        </label>
                      );
                    })}
                  </RadioGroup>
                </FieldSet>
              )}
            />

            <Field data-invalid={!!errors.full_name}>
              <FieldLabel htmlFor="full_name">Nom complet *</FieldLabel>
              <Input
                id="full_name"
                placeholder="Ex. Salma Gharbi"
                aria-invalid={!!errors.full_name}
                aria-describedby={errors.full_name ? 'full_name-error' : undefined}
                {...register('full_name')}
              />
              <FieldError id="full_name-error" errors={[errors.full_name]} />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={!!errors.phone}>
                <FieldLabel htmlFor="phone">Téléphone</FieldLabel>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>+216</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="98 123 456"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                    {...register('phone', { onBlur: () => void checkDuplicates() })}
                  />
                </InputGroup>
                <FieldError id="phone-error" errors={[errors.phone]} />
              </Field>
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="email">E-mail</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="salma.gharbi@email.tn"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email', { onBlur: () => void checkDuplicates() })}
                />
                <FieldError id="email-error" errors={[errors.email]} />
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="national_id">CIN ou matricule fiscal</FieldLabel>
              <Input
                id="national_id"
                placeholder="Ex. 08942155 ou 1489201/A"
                {...register('national_id', { onBlur: () => void checkDuplicates() })}
              />
            </Field>

            <DuplicateNotice matches={duplicates} />

            <Field>
              <FieldLabel htmlFor="address">Adresse</FieldLabel>
              <Input id="address" placeholder="Ex. 14 Rue des Jardins, Carthage, Tunis" {...register('address')} />
            </Field>

            <Field>
              <FieldLabel htmlFor="notes">Notes</FieldLabel>
              <Input id="notes" placeholder="Informations utiles pour l’équipe" {...register('notes')} />
            </Field>

            <Controller
              control={control}
              name="roles"
              render={({ field }) => (
                <FieldSet data-invalid={!!errors.roles}>
                  <FieldLegend variant="label">Rôles *</FieldLegend>
                  <FieldDescription>Un contact peut avoir plusieurs rôles.</FieldDescription>
                  <div className="grid gap-3 md:grid-cols-3">
                    {CONTACT_ROLES.map((role) => {
                      const Icon = role.icon;
                      const selected = field.value.includes(role.value);
                      const locked = lockedRoles.includes(role.value);
                      return (
                        <label
                          key={role.value}
                          htmlFor={'role-' + role.value}
                          className={cn(
                            'flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                            selected ? 'border-primary bg-accent/60' : 'hover:bg-muted',
                            locked && 'cursor-not-allowed opacity-80',
                          )}
                        >
                          <span className="flex items-center justify-between">
                            <span className={cn('flex size-8 items-center justify-center rounded-md', role.tile)}>
                              <Icon className="size-4" aria-hidden />
                            </span>
                            <Checkbox
                              id={'role-' + role.value}
                              aria-invalid={!!errors.roles}
                              disabled={locked}
                              onBlur={field.onBlur}
                              checked={selected}
                              onCheckedChange={(checked) =>
                                field.onChange(checked ? [...field.value, role.value] : field.value.filter((item) => item !== role.value))
                              }
                            />
                          </span>
                          <span className="text-sm font-medium">{role.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {locked ? 'Ce contact détient des unités : ce rôle reste actif.' : role.description}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <FieldError errors={[errors.roles]} />
                </FieldSet>
              )}
            />
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end gap-2 border-t">
          <Button asChild variant="ghost">
            <Link href={cancelHref}>Annuler</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
            {isSubmitting ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Enregistrer le contact'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
