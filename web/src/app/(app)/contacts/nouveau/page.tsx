'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { ArrowLeft, Building2, Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { CONTACT_ROLES } from '@/components/domain/badges';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

const schema = z.object({
  kind: z.enum(['person', 'company']),
  full_name: z.string().trim().min(2, 'Saisissez le nom complet (2 caractères minimum).'),
  phone: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\d{8}$/.test(value.replace(/\s/g, '')), 'Numéro invalide : 8 chiffres attendus (ex. 98 123 456).'),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || z.string().email().safeParse(value).success, 'Adresse e-mail invalide.'),
  national_id: z.string().trim(),
  address: z.string().trim(),
  roles: z.array(z.enum(['owner', 'renter', 'buyer'])).min(1, 'Choisissez au moins un rôle.'),
});

type FormValues = z.infer<typeof schema>;

const orNull = (value: string) => (value === '' ? null : value);

export default function NewContactPage() {
  const router = useRouter();
  const [createdId, setCreatedId] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'person', full_name: '', phone: '', email: '', national_id: '', address: '', roles: [] },
  });
  const { control, register, handleSubmit, formState } = form;
  const { errors, isSubmitting } = formState;

  async function onSubmit(values: FormValues) {
    try {
      let contactId = createdId;
      if (contactId === null) {
        const created = await graphql<{ insert_contacts_one: { id: string } }>(ADD_CONTACT, {
          object: {
            kind: values.kind,
            full_name: values.full_name,
            email: orNull(values.email),
            phone: values.phone === '' ? null : '+216 ' + values.phone,
            national_id: orNull(values.national_id),
            address: orNull(values.address),
          },
        });
        contactId = created.insert_contacts_one.id;
        setCreatedId(contactId);
      }
      await graphql(ADD_ROLES, { objects: values.roles.map((role) => ({ contact_id: contactId, role })) });
      toast.success('Contact créé', { description: values.full_name + ' a été ajouté.' });
      router.push('/contacts/' + contactId);
    } catch (error) {
      toast.error('Enregistrement impossible', {
        description: error instanceof Error ? error.message : 'Erreur inconnue.',
      });
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/contacts">
          <ArrowLeft data-icon="inline-start" />
          Retour aux contacts
        </Link>
      </Button>

      <PageHeader
        title="Ajouter un contact"
        description="Créez la fiche d’un propriétaire, locataire ou acquéreur. Un contact peut cumuler plusieurs rôles."
      />

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
                <Input id="full_name" placeholder="Ex. Salma Gharbi" aria-invalid={!!errors.full_name} aria-describedby={errors.full_name ? "full_name-error" : undefined} {...register("full_name")} />
                <FieldError id="full_name-error" errors={[errors.full_name]} />
              </Field>

              <div className="grid gap-6 sm:grid-cols-2">
                <Field data-invalid={!!errors.phone}>
                  <FieldLabel htmlFor="phone">Téléphone</FieldLabel>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>+216</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput id="phone" type="tel" inputMode="tel" placeholder="98 123 456" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined} {...register('phone')} />
                  </InputGroup>
                  <FieldError id="phone-error" errors={[errors.phone]} />
                </Field>
                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="email">E-mail</FieldLabel>
                  <Input id="email" type="email" placeholder="salma.gharbi@email.tn" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} {...register('email')} />
                  <FieldError id="email-error" errors={[errors.email]} />
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="national_id">CIN ou matricule fiscal</FieldLabel>
                <Input id="national_id" placeholder="Ex. 08942155 ou 1489201/A" {...register('national_id')} />
              </Field>

              <Field>
                <FieldLabel htmlFor="address">Adresse</FieldLabel>
                <Input id="address" placeholder="Ex. 14 Rue des Jardins, Carthage, Tunis" {...register('address')} />
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
                        return (
                          <label
                            key={role.value}
                            htmlFor={'role-' + role.value}
                            className={cn(
                              'flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                              selected ? 'border-primary bg-accent/60' : 'hover:bg-muted',
                            )}
                          >
                            <span className="flex items-center justify-between">
                              <span className={cn('flex size-8 items-center justify-center rounded-md', role.tile)}>
                                <Icon className="size-4" aria-hidden />
                              </span>
                              <Checkbox
                                id={'role-' + role.value}
                                aria-invalid={!!errors.roles}
                                onBlur={field.onBlur}
                                checked={selected}
                                onCheckedChange={(checked) =>
                                  field.onChange(checked ? [...field.value, role.value] : field.value.filter((item) => item !== role.value))
                                }
                              />
                            </span>
                            <span className="text-sm font-medium">{role.label}</span>
                            <span className="text-xs text-muted-foreground">{role.description}</span>
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
              <Link href="/contacts">Annuler</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Save data-icon="inline-start" />}
              {isSubmitting ? 'Enregistrement…' : 'Enregistrer le contact'}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
