'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { QuestionFlow, type FlowStep } from '@/components/forms/question-flow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';

import { useT } from '@/i18n/provider';

export type BranchRow = {
  id: string;
  name: string;
  slug: string | null;
  city: string | null;
  region: string | null;
  address: string | null;
  phone: string | null;
};

const SAVE_BRANCH = `
  mutation SaveBranch($id: uuid, $object: branches_insert_input!) {
    insert_branches_one(object: $object) { id }
  }
`;

type BranchFormMessages = ReturnType<typeof useT>['properties']['branchForm'];

function makeSchema(f: BranchFormMessages) {
  return z.object({
    name: z.string().trim().min(1, f.required),
    slug: z
      .string()
      .trim()
      .min(1, f.required)
      .refine((value) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value.toLowerCase()), f.slugInvalid),
    city: z.string().trim().min(1, f.required),
    region: z.string().trim(),
    address: z.string().trim(),
    phone: z.string().trim(),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

/** Creates or edits an agency (branch): its name, public address, city, region, address and phone. */
export function BranchDialog({
  branch,
  trigger,
  open,
  onOpenChange,
  onSaved,
}: {
  branch?: BranchRow;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useT();
  const f = t.properties.branchForm;
  const [innerOpen, setInnerOpen] = useState(false);
  const isOpen = open ?? innerOpen;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (open === undefined) setInnerOpen(next);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{branch ? f.editTitle(branch.name) : f.addTitle}</DialogTitle>
          <DialogDescription>{f.intro}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from fresh values. */}
        {isOpen && (
          <BranchForm
            branch={branch}
            onCancel={() => setOpen(false)}
            onSaved={() => {
              setOpen(false);
              onSaved();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BranchForm({ branch, onCancel, onSaved }: { branch?: BranchRow; onCancel: () => void; onSaved: () => void }) {
  const t = useT();
  const f = t.properties.branchForm;
  const schema = useMemo(() => makeSchema(f), [f]);
  const { register, handleSubmit, trigger, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: branch?.name ?? '',
      slug: branch?.slug ?? '',
      city: branch?.city ?? '',
      region: branch?.region ?? '',
      address: branch?.address ?? '',
      phone: branch?.phone ?? '',
    },
  });
  const { errors, isSubmitting } = formState;

  async function checkFields(names?: string[]) {
    return trigger(names as FieldPath<FormValues>[] | undefined);
  }

  async function onValid(values: FormValues) {
    try {
      await graphql(SAVE_BRANCH, { id: branch?.id, object: values });
      toast.success(branch ? f.updated : f.created, { description: values.name });
      onSaved();
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const steps: FlowStep[] = [
    {
      id: 'name',
      title: f.nameQuestion,
      fields: ['name'],
      children: (
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="branch-name">{f.name}</FieldLabel>
          <Input id="branch-name" placeholder={f.namePlaceholder} aria-invalid={!!errors.name} {...register('name')} />
          <FieldError id="branch-name-error" errors={[errors.name]} />
        </Field>
      ),
    },
    {
      id: 'slug',
      title: f.slugQuestion,
      help: f.slugHelp,
      fields: ['slug'],
      children: (
        <Field data-invalid={!!errors.slug}>
          <FieldLabel htmlFor="branch-slug">{f.slug}</FieldLabel>
          <Input id="branch-slug" dir="ltr" aria-invalid={!!errors.slug} {...register('slug')} />
          <FieldError id="branch-slug-error" errors={[errors.slug]} />
        </Field>
      ),
    },
    {
      id: 'city',
      title: f.cityQuestion,
      fields: ['city'],
      children: (
        <Field data-invalid={!!errors.city}>
          <FieldLabel htmlFor="branch-city">{f.city}</FieldLabel>
          <Input id="branch-city" aria-invalid={!!errors.city} {...register('city')} />
          <FieldError id="branch-city-error" errors={[errors.city]} />
        </Field>
      ),
    },
    {
      id: 'region',
      title: f.regionQuestion,
      optional: true,
      children: (
        <Field>
          <FieldLabel htmlFor="branch-region">{f.region}</FieldLabel>
          <Input id="branch-region" {...register('region')} />
        </Field>
      ),
    },
    {
      id: 'address',
      title: f.addressQuestion,
      optional: true,
      children: (
        <Field>
          <FieldLabel htmlFor="branch-address">{f.address}</FieldLabel>
          <Input id="branch-address" {...register('address')} />
        </Field>
      ),
    },
    {
      id: 'phone',
      title: f.phoneQuestion,
      optional: true,
      children: (
        <Field>
          <FieldLabel htmlFor="branch-phone">{f.phone}</FieldLabel>
          <Input id="branch-phone" dir="ltr" inputMode="tel" {...register('phone')} />
        </Field>
      ),
    },
  ];

  return (
    <QuestionFlow
      steps={steps}
      trigger={checkFields}
      onSubmit={handleSubmit(onValid)}
      onCancel={onCancel}
      submitting={isSubmitting}
      submitLabel={f.save}
    />
  );
}
