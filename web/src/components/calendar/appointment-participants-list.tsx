'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, MailX } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { AppointmentStatus } from '@/lib/appointment-types';
import { participantEmailLabel, PARTICIPANT_ROLE_LABELS } from '@/lib/appointments';
import { showError } from '@/lib/show-error';
import type { AppointmentDetails } from './appointment-details';
import { resendParticipantMutation } from './appointment-mutations';

type Props = {
  appointmentId: string;
  participants: AppointmentDetails['participants'];
  /** The appointment's « Prévenir par e-mail » switch: it explains why a participant was skipped. */
  notifyByEmail: boolean;
  /** « Renvoyer » only makes sense while the appointment is still planned. */
  appointmentStatus: AppointmentStatus;
  canEdit: boolean;
  onChanged: () => void;
};

export function AppointmentParticipantsList({ appointmentId, participants, notifyByEmail, appointmentStatus, canEdit, onChanged }: Props) {
  const [resending, setResending] = useState<string | null>(null);

  async function resend(contactId: string) {
    setResending(contactId);
    try {
      await resendParticipantMutation(appointmentId, contactId);
      toast.success('E-mail remis en file d’envoi');
      onChanged();
    } catch (error) {
      showError('Envoi impossible', error, () => void resend(contactId));
    } finally {
      setResending(null);
    }
  }

  if (participants.length === 0) return <p className="text-sm text-muted-foreground">Aucun participant.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {participants.map((participant) => {
        const failed = participant.email_status === 'failed';
        const Icon = participant.email_status === 'skipped' || failed ? MailX : Mail;
        return (
          <li key={participant.contact_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <div className="min-w-0">
              <Link href={'/contacts/' + participant.contact.id} className="font-medium text-primary hover:underline">
                {participant.contact.full_name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {PARTICIPANT_ROLE_LABELS[participant.role]}
                {participant.contact.email ? ` · ${participant.contact.email}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="size-3.5" aria-hidden />
              <span>{failed ? 'E-mail non envoyé' : participantEmailLabel(participant.email_status, { notifyByEmail, hasEmail: Boolean(participant.contact.email) })}</span>
              {failed && canEdit && appointmentStatus === 'planned' && (
                <Button type="button" size="xs" variant="outline" disabled={resending === participant.contact_id} onClick={() => void resend(participant.contact_id)}>
                  {resending === participant.contact_id && <Loader2 data-icon="inline-start" className="animate-spin" />}
                  Renvoyer
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
