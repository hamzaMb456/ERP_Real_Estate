'use client';

import { useEffect } from 'react';
import type { ContactOption } from '@/components/ownership/contact-picker';
import { useT } from '@/i18n/provider';
import type { FeedRow } from '@/lib/appointment-types';
import { showError } from '@/lib/show-error';
import { useGraphql } from '@/lib/use-graphql';
import { AppointmentDialog } from './appointment-dialog';
import { APPOINTMENT_QUERY, detailsToInitial, type AppointmentDetails } from './appointment-details';
import type { StaffOption } from './calendar-types';

type Props = {
  appointmentId: string;
  onClose: () => void;
  existing: FeedRow[];
  staff: StaffOption[];
  contacts: ContactOption[];
  onSaved: (id: string) => void;
};

/** Loads one appointment, then opens the dialog on it in edit mode (« Reporter » and « Modifier »). */
export function AppointmentEditor({ appointmentId, onClose, existing, staff, contacts, onSaved }: Props) {
  const t = useT().calendar.editor;
  const result = useGraphql<{ appointment: AppointmentDetails | null }>(APPOINTMENT_QUERY, { id: appointmentId });
  const failure = result.status === 'error' ? result.message : result.status === 'success' && !result.data.appointment ? t.notFound : null;

  useEffect(() => {
    if (failure === null) return;
    showError(t.loadFailed, new Error(failure));
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failure]);

  if (result.status !== 'success' || !result.data.appointment) return null;
  return (
    <AppointmentDialog
      open
      onOpenChange={(open) => !open && onClose()}
      editingId={appointmentId}
      initial={detailsToInitial(result.data.appointment)}
      existing={existing}
      staff={staff}
      contacts={contacts}
      onSaved={onSaved}
    />
  );
}
