'use client';

import { useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Pulse } from '@/components/motion/primitives';
import { useContactOptions } from '@/components/ownership/use-contact-options';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { todayTunis } from '@/lib/dates';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { AppointmentDialog } from './appointment-dialog';
import { AppointmentList } from './appointment-list';
import type { AppointmentInitial } from './appointment-schema';
import { useCalendarLookups } from './use-calendar-lookups';
import { useFeedRows } from './use-calendar-feed';

const LEASE_QUERY = `
  query LeaseCalendar($id: uuid!) {
    lease: leases_by_pk(id: $id) {
      id
      units(limit: 1) { unit { id code property { name } } }
      parties(where: { role: { _eq: "renter" } }) { contact_id }
    }
  }
`;

type LeaseForCalendar = {
  id: string;
  units: { unit: { id: string; code: string; property: { name: string } } }[];
  parties: { contact_id: string }[];
};

/** The « Calendrier » tab of a lease: its appointments, and a shortcut to plan the move-in check. */
export function LeaseCalendarTab({ leaseId }: { leaseId: string }) {
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [today] = useState(() => todayTunis());
  const lease = useGraphql<{ lease: LeaseForCalendar | null }>(LEASE_QUERY, { id: leaseId });
  const appointments = useFeedRows({ source: { _eq: 'appointment' }, lease_id: { _eq: leaseId } }, reload);
  // Planned appointments from today on: what a new one could clash with.
  const upcoming = useFeedRows({ source: { _eq: 'appointment' }, ends_at: { _gte: today + 'T00:00:00+01:00' } }, reload);
  const lookups = useCalendarLookups();
  const contacts = useContactOptions();

  const leased = lease.status === 'success' ? lease.data.lease : null;
  const ready = leased !== null && lookups.status === 'success' && contacts.status === 'success';
  const firstUnit = leased?.units[0]?.unit;
  const initial: AppointmentInitial = {
    kind: 'move_in',
    leaseId,
    unitId: firstUnit?.id,
    title: firstUnit ? `État des lieux d’entrée · ${firstUnit.code}` : 'État des lieux d’entrée',
    participants: (leased?.parties ?? []).map((party) => ({ contactId: party.contact_id, role: 'renter' as const })),
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rendez-vous du bail</CardTitle>
        <CardDescription>États des lieux, visites et réunions liés à ce bail.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {canEdit && (
          <Button variant="outline" disabled={!ready} onClick={() => setPlanning(true)}>
            <ClipboardCheck data-icon="inline-start" />
            Planifier un état des lieux
          </Button>
        )}
        {appointments.status === 'loading' && <Pulse className="text-muted-foreground">Chargement des rendez-vous…</Pulse>}
        {appointments.status === 'error' && <p role="alert" className="text-destructive">Impossible de charger les rendez-vous : {appointments.message}</p>}
        {appointments.status === 'success' && <AppointmentList rows={appointments.data} emptyText="Aucun rendez-vous pour ce bail." />}
      </CardContent>

      {planning && lookups.status === 'success' && contacts.status === 'success' && (
        <AppointmentDialog
          open
          onOpenChange={(open) => !open && setPlanning(false)}
          initial={initial}
          existing={upcoming.status === 'success' ? upcoming.data : []}
          staff={lookups.data.staff}
          contacts={contacts.data}
          onSaved={() => setReload((value) => value + 1)}
        />
      )}
    </Card>
  );
}
