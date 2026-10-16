'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Building2, Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { CONTACT_ROLES, type ContactRole } from '@/components/domain/badges';
import { DuplicateNotice } from '@/components/domain/duplicate-notice';
import { FieldHelp, FieldLabelWithHelp } from '@/components/field-help';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSet } from '@/components/ui/field';
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
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { cn } from '@/lib/utils';

import type { Messages } from '@/i18n/messages';
import { useT } from '@/i18n/provider';
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

function makeSchema(m: Messages['contacts']['form']) {
  return z.object({
  kind: z.enum(['person', 'company']),
  full_name: z.string().trim().min(2, m.nameRequired),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || normalizePhone(value).length === 8, m.phoneInvalid),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || z.string().email().safeParse(value).success, m.emailInvalid),
  national_id: z.string().trim(),
  address: z.string().trim(),
  notes: z.string().trim(),
  roles: z.array(z.enum(['owner', 'renter', 'buyer'])).min(1, m.rolesRequired),
  });
}

export type ContactFormValues = z.infer<ReturnType<typeof makeSchema>>;

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
  const t = useT();
  const schema = useMemo(() => makeSchema(t.contacts.form), [t]);
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
        toast.success(t.contacts.form.updated, { description: values.full_name });
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
      toast.success(t.contacts.form.created, { description: t.contacts.form.createdBody(values.full_name) });
      router.push('/contacts/' + contactId);
    } catch (error) {
      toast.error(t.contacts.form.saveFailed, { description: toUserMessage(error) });
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
                  <FieldLegend variant="label" className="flex items-center gap-1.5">
                    {t.contacts.form.kind}
                    <FieldHelp>{t.contacts.form.kindHelp}</FieldHelp>
                  </FieldLegend>
                  <RadioGroup value={field.value} onValueChange={field.onChange} className="grid max-w-md grid-cols-2 gap-3">
                    {(
                      [
                        { value: 'person', label: t.contacts.kinds.person, icon: User },
                        { value: 'company', label: t.contacts.kinds.company, icon: Building2 },
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
              <FieldLabelWithHelp htmlFor="full_name" help={t.contacts.form.fullNameHelp}>
                {t.contacts.form.fullName}
              </FieldLabelWithHelp>
              <Input
                id="full_name"
                placeholder={t.contacts.form.fullNamePlaceholder}
                aria-invalid={!!errors.full_name}
                aria-describedby={errors.full_name ? 'full_name-error' : undefined}
                {...register('full_name')}
              />
              <FieldError id="full_name-error" errors={[errors.full_name]} />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field data-invalid={!!errors.phone}>
                <FieldLabelWithHelp htmlFor="phone" help={t.contacts.form.phoneHelp}>
                  {t.contacts.form.phone}
                </FieldLabelWithHelp>
                <InputGroup>
                  <InputGroupAddon>
                    <InputGroupText>+216</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder={t.contacts.form.phonePlaceholder}
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                    {...register('phone', { onBlur: () => void checkDuplicates() })}
                  />
                </InputGroup>
                <FieldError id="phone-error" errors={[errors.phone]} />
              </Field>
              <Field data-invalid={!!errors.email}>
                <FieldLabelWithHelp htmlFor="email" help={t.contacts.form.emailHelp}>
                  {t.contacts.form.email}
                </FieldLabelWithHelp>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.contacts.form.emailPlaceholder}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email', { onBlur: () => void checkDuplicates() })}
                />
                <FieldError id="email-error" errors={[errors.email]} />
              </Field>
            </div>

            <Field>
              <FieldLabelWithHelp htmlFor="national_id" help={t.contacts.form.nationalIdHelp}>
                {t.contacts.form.nationalId}
              </FieldLabelWithHelp>
              <Input
                id="national_id"
                placeholder={t.contacts.form.nationalIdPlaceholder}
                {...register('national_id', { onBlur: () => void checkDuplicates() })}
              />
            </Field>

            <DuplicateNotice matches={duplicates} />

            <Field>
              <FieldLabelWithHelp htmlFor="address" help={t.contacts.form.addressHelp}>
                {t.contacts.form.address}
              </FieldLabelWithHelp>
              <Input id="address" placeholder={t.contacts.form.addressPlaceholder} {...register('address')} />
            </Field>

            <Field>
              <FieldLabelWithHelp htmlFor="notes" help={t.contacts.form.notesHelp}>
                {t.contacts.form.notes}
              </FieldLabelWithHelp>
              <Input id="notes" placeholder={t.contacts.form.notesPlaceholder} {...register('notes')} />
            </Field>

            <Controller
              control={control}
              name="roles"
              render={({ field }) => (
                <FieldSet data-invalid={!!errors.roles}>
                  <FieldLegend variant="label" className="flex items-center gap-1.5">
                    {t.contacts.form.roles}
                    <FieldHelp>
                      {t.contacts.form.rolesHelp}
                    </FieldHelp>
                  </FieldLegend>
                  <FieldDescription>{t.contacts.form.rolesHint}</FieldDescription>
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
                          <span className="text-sm font-medium">{t.labels.contactRoles[role.value].label}</span>
                          <span className="text-xs text-muted-foreground">
                            {locked ? t.contacts.form.roleLocked : t.labels.contactRoles[role.value].description}
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
            <Link href={cancelHref}>{t.common.cancel}</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
            {isSubmitting ? t.common.saving : editing ? t.common.saveChanges : t.contacts.form.saveContact}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
