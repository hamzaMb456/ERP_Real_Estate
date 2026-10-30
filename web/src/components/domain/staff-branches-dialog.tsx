'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm, type FieldPath } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { MultiChips, QuestionFlow, type FlowStep } from '@/components/forms/question-flow';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { StaffStatus } from '@/components/domain/staff-actions';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';

import { useT } from '@/i18n/provider';

export type StaffRow = { user_id: string; display_name: string; email: string | null; branch_ids: string[]; status: StaffStatus };
export type BranchOption = { id: string; name: string };

const SET_STAFF_BRANCHES = `
  mutation SetStaffBranches($user_id: ID!, $branch_ids: [ID!]!) {
    update_staff_assignments(user_id: $user_id, branch_ids: $branch_ids) { affected_rows }
  }
`;

/** Chooses the agencies a regional staff member works in. Their records outside these agencies disappear for them. */
export function StaffBranchesDialog({
  member,
  branches,
  trigger,
  open,
  onOpenChange,
  onSaved,
}: {
  member: StaffRow;
  branches: BranchOption[];
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
          <DialogTitle>{member.display_name}</DialogTitle>
          <DialogDescription>{f.assign}</DialogDescription>
        </DialogHeader>
        {isOpen && (
          <AssignForm
            member={member}
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

function AssignForm({ member, branches, onCancel, onSaved }: { member: StaffRow; branches: BranchOption[]; onCancel: () => void; onSaved: () => void }) {
  const t = useT();
  const f = t.properties.branchForm;
  const schema = useMemo(() => z.object({ branch_ids: z.array(z.string()).min(1, f.required) }), [f]);
  type FormValues = z.infer<typeof schema>;
  const { control, handleSubmit, trigger, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { branch_ids: member.branch_ids },
  });
  const { errors, isSubmitting } = formState;

  async function checkFields(names?: string[]) {
    return trigger(names as FieldPath<FormValues>[] | undefined);
  }

  async function onValid(values: FormValues) {
    try {
      await graphql(SET_STAFF_BRANCHES, { user_id: member.user_id, branch_ids: values.branch_ids });
      toast.success(f.assigned);
      onSaved();
    } catch (error) {
      toast.error(toUserMessage(error));
    }
  }

  const steps: FlowStep[] = [
    {
      id: 'branches',
      title: f.assignQuestion,
      fields: ['branch_ids'],
      children: (
        <Controller
          control={control}
          name="branch_ids"
          render={({ field }) => (
            <div aria-invalid={!!errors.branch_ids}>
              <MultiChips
                label={f.staffBranches}
                value={field.value}
                options={branches.map((b) => ({ value: b.id, label: b.name }))}
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
      submitLabel={f.assignSave}
    />
  );
}
