'use client';

import { useState } from 'react';
import { SkeletonList } from '@/components/motion/primitives';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useT } from '@/i18n/provider';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { APPOINTMENT_QUERY, type AppointmentDetails } from './appointment-details';
import { AppointmentSheetContent } from './appointment-sheet-content';

type Props = {
  appointmentId: string | null;
  onOpenChange: (open: boolean) => void;
  /** « Reporter »: the page opens the edit dialog on this appointment. */
  onEdit: (id: string) => void;
  /** Called after a status change, so the calendar can reload. */
  onChanged?: () => void;
};

export function AppointmentSheet({ appointmentId, onOpenChange, onEdit, onChanged }: Props) {
  return (
    <Sheet open={appointmentId !== null} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {appointmentId !== null && <SheetBody key={appointmentId} id={appointmentId} onEdit={onEdit} onChanged={onChanged} />}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ id, onEdit, onChanged }: { id: string; onEdit: Props['onEdit']; onChanged: Props['onChanged'] }) {
  const t = useT().calendar.sheet;
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const result = useGraphql<{ appointment: AppointmentDetails | null }>(APPOINTMENT_QUERY, { id }, reload);
  const refresh = () => {
    setReload((value) => value + 1);
    onChanged?.();
  };

  if (result.status === 'loading') {
    return (
      <>
        <SheetHeader>
          <SheetTitle>{t.title}</SheetTitle>
          <SheetDescription className="sr-only">{t.loading}</SheetDescription>
        </SheetHeader>
        <SkeletonList count={4} className="space-y-3 px-4" itemClassName="h-10 rounded-lg bg-muted" label={t.loading} />
      </>
    );
  }
  if (result.status === 'error' || !result.data.appointment) {
    return (
      <SheetHeader>
        <SheetTitle>{t.title}</SheetTitle>
        <SheetDescription role="alert">{result.status === 'error' ? t.loadError(result.message) : t.notFound}</SheetDescription>
      </SheetHeader>
    );
  }
  return <AppointmentSheetContent appointment={result.data.appointment} canEdit={canEdit} onEdit={onEdit} onChanged={refresh} />;
}
