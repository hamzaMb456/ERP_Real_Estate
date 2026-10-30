'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { MultiChips, QuestionFlow, type FlowStep } from '@/components/forms/question-flow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { toUserMessage } from '@/lib/errors';
import { staffAction } from '@/lib/staff-api';

import { useT } from '@/i18n/provider';

type Messages = ReturnType<typeof useT>['properties']['branchForm'];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function makeSchema(f: Messages) {
  return z.object({
    name: z.string().trim().min(1, f.required),
    email: z.string().trim().regex(EMAIL, f.staffEmailInvalid),
    branch_ids: z.array(z.string()).min(1, f.staffAgenciesRequired),
  });
}

type FormValues = z.infer<ReturnType<typeof makeSchema>>;

/** Creates a regional staff account: name, email and agencies. The person receives an invitation by email. */
export function StaffCreateDialog({
  branches,
  trigger,
  onSaved,
}: {
  branches: { id: string; name: string }[];
  trigger: ReactNode;
  onSaved: () => void;
}) {
  const f = useT().properties.branchForm;
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{f.newStaffTitle}</DialogTitle>
          <DialogDescription>{f.newStaffIntro}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts empty. */}
        {open && (
          <CreateForm
            branches={branches}
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

function CreateForm({ branches, onCancel, onSaved }: { branches: { id: string; name: string }[]; onCancel: () => void; onSaved: () => void }) {
  const f = useT().properties.branchForm;
  const schema = useMemo(() => makeSchema(f), [f]);
  const { control, register, handleSubmit, trigger, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', branch_ids: [] },
  });
  const { errors, isSubmitting } = formState;

  async function checkFields(names?: string[]) {
    return trigger(names as FieldPath<FormValues>[] | undefined);
  }

  async function onValid(values: FormValues) {
    try {
      await staffAction('create', { name: values.name, email: values.email, branchIds: values.branch_ids });
      toast.success(f.staffCreated, { description: values.name });
      onSaved();
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const steps: FlowStep[] = [
    {
      id: 'name',
      title: f.staffNameQuestion,
      fields: ['name'],
      children: (
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="staff-name">{f.staffName}</FieldLabel>
          <Input id="staff-name" autoComplete="off" aria-invalid={!!errors.name} {...register('name')} />
          <FieldError id="staff-name-error" errors={[errors.name]} />
        </Field>
      ),
    },
    {
      id: 'email',
      title: f.staffEmailQuestion,
      fields: ['email'],
      children: (
        <Field data-invalid={!!errors.email}>
          <FieldLabel htmlFor="staff-email">{f.staffEmail}</FieldLabel>
          <Input id="staff-email" type="text" inputMode="email" dir="ltr" autoComplete="off" aria-invalid={!!errors.email} {...register('email')} />
          <FieldError id="staff-email-error" errors={[errors.email]} />
        </Field>
      ),
    },
    {
      id: 'agencies',
      title: f.staffAgenciesQuestion,
      fields: ['branch_ids'],
      children: (
        <Controller
          control={control}
          name="branch_ids"
          render={({ field }) => (
            <div>
              <MultiChips
                label={f.staffAgenciesQuestion}
                value={field.value}
                options={branches.map((branch) => ({ value: branch.id, label: branch.name }))}
                onChange={field.onChange}
              />
              {errors.branch_ids && <p className="mt-2 text-sm text-destructive">{errors.branch_ids.message}</p>}
            </div>
          )}
        />
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
      submitLabel={f.staffCreate}
    />
  );
}
