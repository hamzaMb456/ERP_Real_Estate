'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Building2, CalendarClock, Check, FileText, MapPin, Pencil, UserRound, X, type LucideIcon } from '@/components/icons';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useT } from '@/i18n/provider';
import { formatLeaseNumber } from '@/lib/leases';
import { showError } from '@/lib/show-error';
import type { AppointmentDetails } from './appointment-details';
import { setAppointmentStatusMutation } from './appointment-mutations';
import { AppointmentParticipantsList } from './appointment-participants-list';
import { AppointmentKindBadge, AppointmentStatusBadge } from './appointment-status-badge';
import { formatRange } from './calendar-format';

type Props = {
  appointment: AppointmentDetails;
  canEdit: boolean;
  onEdit: (id: string) => void;
  onChanged: () => void;
};

/** The loaded appointment: header with badges and actions, details, participants, cancel confirmation. */
export function AppointmentSheetContent({ appointment, canEdit, onEdit, onChanged }: Props) {
  const { sheet: t, kinds } = useT().calendar;
  const [confirmCancel, setConfirmCancel] = useState(false);
  const planned = appointment.status === 'planned';

  async function changeStatus(status: 'done' | 'cancelled', success: string) {
    try {
      await setAppointmentStatusMutation(appointment.id, status);
      toast.success(success, { description: appointment.title });
      onChanged();
    } catch (error) {
      showError(t.actionFailed, error, () => void changeStatus(status, success));
    }
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{appointment.title}</SheetTitle>
        <SheetDescription className="flex flex-wrap items-center gap-1.5">
          <AppointmentKindBadge label={kinds[appointment.kind] ?? appointment.kind} />
          <AppointmentStatusBadge status={appointment.status} />
        </SheetDescription>
      </SheetHeader>

      <div className="space-y-6 px-4 pb-4 text-sm">
        {canEdit && planned && (
          <div role="group" aria-label={t.actions} className="flex flex-wrap gap-2">
            <Button onClick={() => void changeStatus('done', t.markedDone)}>
              <Check data-icon="inline-start" />
              {t.markDone}
            </Button>
            <Button variant="outline" onClick={() => onEdit(appointment.id)}>
              <Pencil data-icon="inline-start" />
              {t.postpone}
            </Button>
            <Button variant="outline" onClick={() => setConfirmCancel(true)}>
              <X data-icon="inline-start" />
              {t.cancel}
            </Button>
          </div>
        )}

        <dl className="space-y-3">
          <Row icon={CalendarClock} label={t.when}>
            <When startsAt={appointment.starts_at} endsAt={appointment.ends_at} />
          </Row>
          {appointment.location && (
            <Row icon={MapPin} label={t.location}>
              {appointment.location}
            </Row>
          )}
          <Row icon={UserRound} label={t.assignee}>
            {appointment.assigned_user?.display_name ?? t.unassigned}
          </Row>
          {appointment.unit && (
            <Row icon={Building2} label={t.unit}>
              <Link href={`/biens/${appointment.unit.property.id}/unites/${appointment.unit.id}`} className="text-primary hover:underline">
                <span dir="ltr">{appointment.unit.code}</span> · {appointment.unit.property.name}
              </Link>
            </Row>
          )}
          {appointment.lease && (
            <Row icon={FileText} label={t.lease}>
              <Link href={'/baux/' + appointment.lease.id} className="text-primary hover:underline">
                {formatLeaseNumber(appointment.lease.number)}
              </Link>
            </Row>
          )}
        </dl>
        {appointment.notes && <p className="whitespace-pre-line rounded-lg bg-muted px-3 py-2">{appointment.notes}</p>}

        <section className="space-y-3">
          <h3 className="text-base font-medium">{t.participants}</h3>
          <AppointmentParticipantsList
            appointmentId={appointment.id}
            participants={appointment.participants}
            notifyByEmail={appointment.notify_by_email}
            appointmentStatus={appointment.status}
            canEdit={canEdit}
            onChanged={onChanged}
          />
          {!appointment.notify_by_email && <p className="text-xs text-muted-foreground">{t.emailsOff}</p>}
        </section>
      </div>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t.cancelTitle}
        description={appointment.notify_by_email ? t.cancelNotify : t.cancelSilent}
        confirmLabel={t.cancelConfirm}
        onConfirm={() => changeStatus('cancelled', t.cancelled)}
      />
    </>
  );
}

/** « vendredi 16 octobre 2026 · 09:00 – 10:00 »: the day in the interface language, the times left-to-right. */
function When({ startsAt, endsAt }: { startsAt: string; endsAt: string }) {
  const arrow = useT().common.arrow;
  const range = formatRange(startsAt, endsAt);
  if (range.endDay === null) {
    return (
      <>
        {range.day} ·{' '}
        <span dir="ltr" className="tabular-nums">
          {range.startTime} – {range.endTime}
        </span>
      </>
    );
  }
  return (
    <>
      {range.day} · <span dir="ltr" className="tabular-nums">{range.startTime}</span> {arrow} {range.endDay}{' '}
      <span dir="ltr" className="tabular-nums">
        {range.endTime}
      </span>
    </>
  );
}

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
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
