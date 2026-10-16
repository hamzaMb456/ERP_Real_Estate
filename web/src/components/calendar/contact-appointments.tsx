'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Pulse } from '@/components/motion/primitives';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [now] = useState(() => Date.now());
  const result = useGraphql<{ appointment_participants: Participation[] }>(CONTACT_APPOINTMENTS_QUERY, { contactId });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="size-4 text-muted-foreground" />
          Rendez-vous
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {result.status === 'loading' && <Pulse className="text-muted-foreground">Chargement des rendez-vous…</Pulse>}
        {result.status === 'error' && <p role="alert" className="text-destructive">Impossible de charger les rendez-vous : {result.message}</p>}
        {result.status === 'success' && <Lists participations={result.data.appointment_participants} now={now} />}
      </CardContent>
    </Card>
  );
}

function Lists({ participations, now }: { participations: Participation[]; now: number }) {
  const { upcoming, past } = split(participations, now);
  return (
    <>
      <section className="space-y-2">
        <h3 className="font-medium">À venir</h3>
        <AppointmentList rows={upcoming} emptyText="Aucun rendez-vous à venir." />
      </section>
      <section className="space-y-2">
        <h3 className="font-medium">Passés</h3>
        <AppointmentList rows={past} emptyText="Aucun rendez-vous passé." />
      </section>
    </>
  );
}
