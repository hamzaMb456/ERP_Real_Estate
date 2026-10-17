'use client';

import { useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, FormProvider, useForm, useFormContext } from 'react-hook-form';
import { Loader2, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import type { ContactOption } from '@/components/ownership/contact-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/i18n/provider';
import { findStaffConflicts } from '@/lib/appointments';
import type { AppointmentStatus, FeedRow } from '@/lib/appointment-types';
import { toUserMessage } from '@/lib/errors';
import { AppointmentFormFields } from './appointment-form-fields';
import {
  changedFields,
  diffParticipants,
  insertAppointmentMutation,
  updateAppointmentMutation,
} from './appointment-mutations';
import { AppointmentParticipantsField } from './appointment-participants-field';
import {
  appointmentSchema,
  buildDefaults,
  slotOf,
  toFields,
  toParticipants,
  type AppointmentFormValues,
  type AppointmentInitial,
} from './appointment-schema';
import type { StaffOption } from './calendar-types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: AppointmentInitial;
  /** Set to edit that appointment: only what changed is sent. */
  editingId?: string;
  /** Feed rows around the appointment, to warn when the staff member is already busy. */
  existing: FeedRow[];
  staff: StaffOption[];
  contacts: ContactOption[];
  onSaved: (id: string) => void;
};

export function AppointmentDialog({ open, onOpenChange, ...formProps }: Props) {
  const t = useT().calendar.dialog;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{formProps.editingId ? t.editTitle : t.newTitle}</DialogTitle>
          <DialogDescription>{formProps.editingId ? t.editDescription : t.newDescription}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so every opening starts from fresh values. */}
        <AppointmentForm {...formProps} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function StaffConflictWarning({ editingId, existing }: Pick<Props, 'editingId' | 'existing'>) {
  const t = useT().calendar.dialog;
  const { watch } = useFormContext<AppointmentFormValues>();
  const [date, time, duration, assignedUserId] = watch(['date', 'time', 'duration', 'assignedUserId']);
  const slot = slotOf({ date, time, duration });
  const others = useMemo(
    () =>
      existing.flatMap((row) =>
        row.source === 'appointment' && row.appointment_id
          ? [
              {
                id: row.appointment_id,
                status: row.status as AppointmentStatus,
                assignedUserId: row.assigned_user_id,
                startsAt: row.starts_at,
                endsAt: row.ends_at,
              },
            ]
          : [],
      ),
    [existing],
  );
  if (!slot || assignedUserId === '') return null;
  const conflicts = findStaffConflicts({ id: editingId, assignedUserId, ...slot }, others);
  if (conflicts.length === 0) return null;
  return (
    <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-warning">
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      {t.staffConflict}
    </p>
  );
}

function AppointmentForm({ initial, editingId, existing, staff, contacts, onSaved, onClose }: Omit<Props, 'open' | 'onOpenChange'> & { onClose: () => void }) {
  const tr = useT();
  const t = tr.calendar.dialog;
  const [defaults] = useState(() => buildDefaults(initial));
  const [schema] = useState(appointmentSchema);
  const form = useForm<AppointmentFormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const [error, setError] = useState<string | null>(null);
  const { handleSubmit, control, formState } = form;

  async function onSubmit(values: AppointmentFormValues) {
    const slot = slotOf(values);
    if (!slot) return;
    setError(null);
    const leaseId = initial?.leaseId ?? null;
    const fields = toFields(values, slot, leaseId);
    const participants = toParticipants(values);
    try {
      if (editingId) {
        const beforeSlot = slotOf(defaults);
        const before = toFields(defaults, beforeSlot ?? slot, leaseId);
        await updateAppointmentMutation(editingId, changedFields(before, fields), diffParticipants(initial?.participants ?? [], participants));
        toast.success(t.updated, { description: values.title });
        onSaved(editingId);
      } else {
        const id = crypto.randomUUID();
        await insertAppointmentMutation(id, fields, participants);
        toast.success(t.created, { description: values.title });
        onSaved(id);
      }
      onClose();
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <AppointmentFormFields staff={staff} />
        <StaffConflictWarning editingId={editingId} existing={existing} />
        <Controller
          control={control}
          name="participants"
          render={({ field }) => (
            <AppointmentParticipantsField
              value={field.value}
              onChange={field.onChange}
              contacts={contacts}
              error={formState.errors.participants?.message ?? formState.errors.participants?.root?.message}
            />
          )}
        />
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={formState.isSubmitting}>
            {tr.common.cancel}
          </Button>
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting && <Loader2 data-icon="inline-start" className="animate-spin" />}
            {tr.common.save}
          </Button>
        </DialogFooter>
      </form>
    </FormProvider>
  );
}
