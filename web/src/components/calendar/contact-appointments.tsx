'use client';

import { useState } from 'react';
import { CalendarClock, CalendarDays, History } from 'lucide-react';
import { SkeletonList } from '@/components/motion/primitives';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/i18n/provider';
import type { AppointmentKind, AppointmentStatus } from '@/lib/appointment-types';
import { useGraphql } from '@/lib/use-graphql';
import { AppointmentList, type AppointmentListItem } from './appointment-list';

// The server filters on the contact's own participations, so a busy agency's other appointments
// never crowd this card out. Newest first; 200 is far above what one contact accumulates.
const CONTACT_APPOINTMENTS_QUERY = `
  query ContactAppointments($contactId: uuid!) {
    appointment_participants(
      where: { contact_id: { _eq: $contactId } }
      order_by: [{ appointment: { starts_at: desc } }]
      limit: 200
    ) {
      role
      email_status
      appointment { id title kind status starts_at ends_at location unit_id lease_id }
    }
  }
`;

type ContactAppointment = {
  id: string;
  title: string;
  kind: AppointmentKind;
  status: AppointmentStatus;
  starts_at: string;
  ends_at: string;
  location: string | null;
  unit_id: string | null;
  lease_id: string | null;
};

type Participation = { role: string; email_status: string; appointment: ContactAppointment };

const toItem = (appointment: ContactAppointment): AppointmentListItem => ({
  event_id: appointment.id,
  appointment_id: appointment.id,
  title: appointment.title,
  kind: appointment.kind,
  status: appointment.status,
  starts_at: appointment.starts_at,
  location: appointment.location,
});

function split(participations: Participation[], now: number): { upcoming: AppointmentListItem[]; past: AppointmentListItem[] } {
  const appointments = participations.map((participation) => participation.appointment);
  const isUpcoming = (appointment: ContactAppointment) => appointment.status === 'planned' && Date.parse(appointment.ends_at) >= now;
  return {
    upcoming: appointments
      .filter(isUpcoming)
      .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
      .map(toItem),
    past: appointments.filter((appointment) => !isUpcoming(appointment)).map(toItem),
  };
}

/** Upcoming and past appointments of a contact, read through the contact's participations. */
export function ContactAppointments({ contactId }: { contactId: string }) {
  const t = useT().calendar.contactCard;
  const [now] = useState(() => Date.now());
  const result = useGraphql<{ appointment_participants: Participation[] }>(CONTACT_APPOINTMENTS_QUERY, { contactId });

  return (
    <Card className="rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
          {t.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {result.status === 'loading' && <SkeletonList count={3} className="space-y-2" itemClassName="h-10 rounded-lg bg-muted" label={t.loading} />}
        {result.status === 'error' && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
            {t.loadError(result.message)}
          </p>
        )}
        {result.status === 'success' && <Lists participations={result.data.appointment_participants} now={now} />}
      </CardContent>
    </Card>
  );
}

function Lists({ participations, now }: { participations: Participation[]; now: number }) {
  const t = useT().calendar.contactCard;
  const { upcoming, past } = split(participations, now);
  return (
    <>
      <section className="space-y-3">
        <h3 className="font-medium">{t.upcoming}</h3>
        <AppointmentList rows={upcoming} empty={{ icon: CalendarClock, title: t.noUpcoming }} />
      </section>
      <section className="space-y-3">
        <h3 className="font-medium">{t.past}</h3>
        <AppointmentList rows={past} empty={{ icon: History, title: t.noPast }} />
      </section>
    </>
  );
}
