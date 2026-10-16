'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Building2, CalendarClock, Check, FileText, MapPin, Pencil, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { APPOINTMENT_KIND_LABELS, APPOINTMENT_STATUS_LABELS } from '@/lib/appointments';
import { formatLeaseNumber } from '@/lib/leases';
import { showError } from '@/lib/show-error';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { APPOINTMENT_QUERY, type AppointmentDetails } from './appointment-details';
import { setAppointmentStatusMutation } from './appointment-mutations';
import { AppointmentParticipantsList } from './appointment-participants-list';
import { formatRange } from './calendar-format';

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
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const result = useGraphql<{ appointment: AppointmentDetails | null }>(APPOINTMENT_QUERY, { id }, reload);
  const refresh = () => {
    setReload((value) => value + 1);
    onChanged?.();
  };

  if (result.status === 'loading') {
    return (
      <SheetHeader>
        <SheetTitle>Rendez-vous</SheetTitle>
        <SheetDescription>Chargement…</SheetDescription>
      </SheetHeader>
    );
  }
  if (result.status === 'error' || !result.data.appointment) {
    return (
      <SheetHeader>
        <SheetTitle>Rendez-vous</SheetTitle>
        <SheetDescription role="alert">
          {result.status === 'error' ? `Impossible de charger ce rendez-vous : ${result.message}` : 'Ce rendez-vous n’existe pas ou vous n’y avez pas accès.'}
        </SheetDescription>
      </SheetHeader>
    );
  }
  return <AppointmentContent appointment={result.data.appointment} canEdit={canEdit} onEdit={onEdit} onChanged={refresh} />;
}

function AppointmentContent({
  appointment,
  canEdit,
  onEdit,
  onChanged,
}: {
  appointment: AppointmentDetails;
  canEdit: boolean;
  onEdit: (id: string) => void;
  onChanged: () => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const planned = appointment.status === 'planned';

  async function changeStatus(status: 'done' | 'cancelled', success: string) {
    try {
      await setAppointmentStatusMutation(appointment.id, status);
      toast.success(success, { description: appointment.title });
      onChanged();
    } catch (error) {
      showError('Action impossible', error, () => void changeStatus(status, success));
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{appointment.title}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{APPOINTMENT_KIND_LABELS[appointment.kind]}</Badge>
          <Badge variant={appointment.status === 'cancelled' ? 'destructive' : appointment.status === 'done' ? 'outline' : 'default'}>
            {APPOINTMENT_STATUS_LABELS[appointment.status]}
          </Badge>
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-5 px-4 pb-4 text-sm">
        <dl className="space-y-3">
          <Row icon={CalendarClock} label="Quand">
            {formatRange(appointment.starts_at, appointment.ends_at)}
          </Row>
          {appointment.location && (
            <Row icon={MapPin} label="Lieu">
              {appointment.location}
            </Row>
          )}
          <Row icon={UserRound} label="En charge">
            {appointment.assigned_user?.display_name ?? 'Non assigné'}
          </Row>
          {appointment.unit && (
            <Row icon={Building2} label="Unité">
              <Link href={`/biens/${appointment.unit.property.id}/unites/${appointment.unit.id}`} className="text-primary hover:underline">
                {appointment.unit.code} · {appointment.unit.property.name}
              </Link>
            </Row>
          )}
          {appointment.lease && (
            <Row icon={FileText} label="Bail">
              <Link href={'/baux/' + appointment.lease.id} className="text-primary hover:underline">
                {formatLeaseNumber(appointment.lease.number)}
              </Link>
            </Row>
          )}
        </dl>
        {appointment.notes && <p className="whitespace-pre-line rounded-lg bg-muted px-3 py-2">{appointment.notes}</p>}

        <section className="space-y-2">
          <h3 className="font-medium">Participants</h3>
          <AppointmentParticipantsList
            appointmentId={appointment.id}
            participants={appointment.participants}
            notifyByEmail={appointment.notify_by_email}
            appointmentStatus={appointment.status}
            canEdit={canEdit}
            onChanged={onChanged}
          />
          {!appointment.notify_by_email && <p className="text-xs text-muted-foreground">Les e-mails sont désactivés pour ce rendez-vous.</p>}
        </section>

        {canEdit && planned && (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <Button onClick={() => void changeStatus('done', 'Rendez-vous marqué comme fait')}>
              <Check data-icon="inline-start" />
              Marquer comme fait
            </Button>
            <Button variant="outline" onClick={() => onEdit(appointment.id)}>
              <Pencil data-icon="inline-start" />
              Reporter
            </Button>
            <Button variant="outline" onClick={() => setConfirmCancel(true)}>
              <X data-icon="inline-start" />
              Annuler
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Annuler ce rendez-vous ?"
        description={
          appointment.notify_by_email
            ? 'Les participants qui ont une adresse e-mail seront prévenus de l’annulation.'
            : 'Le rendez-vous reste dans le calendrier, marqué comme annulé.'
        }
        confirmLabel="Annuler le rendez-vous"
        onConfirm={() => changeStatus('cancelled', 'Rendez-vous annulé')}
      />
    </>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="font-medium">{children}</dd>
      </div>
    </div>
  );
}
