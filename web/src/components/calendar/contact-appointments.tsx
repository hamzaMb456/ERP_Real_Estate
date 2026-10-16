'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { Pulse } from '@/components/motion/primitives';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FeedRow } from '@/lib/appointment-types';
import { filterFeed } from '@/lib/calendar';
import { addDays, todayTunis } from '@/lib/dates';
import { AppointmentList } from './appointment-list';
import { EMPTY_FILTERS } from './calendar-types';
import { useFeedRows } from './use-calendar-feed';

// The contact page shows a year around today; older history lives in the calendar.
const WINDOW_DAYS = 365;

function split(rows: FeedRow[], contactId: string, now: number): { upcoming: FeedRow[]; past: FeedRow[] } {
  const mine = filterFeed(rows, { ...EMPTY_FILTERS, contactId, includeCancelled: true }).filter((row) => row.source === 'appointment');
  const upcoming = mine.filter((row) => row.status === 'planned' && Date.parse(row.ends_at) >= now);
  return {
    upcoming: [...upcoming].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
    past: mine.filter((row) => !upcoming.includes(row)),
  };
}

/** Upcoming and past appointments of a contact, from the calendar feed. */
export function ContactAppointments({ contactId }: { contactId: string }) {
  const [now] = useState(() => Date.now());
  const [range] = useState(() => {
    const today = todayTunis();
    return { starts_at: { _gte: addDays(today, -WINDOW_DAYS) + 'T00:00:00+01:00' }, ends_at: { _lte: addDays(today, WINDOW_DAYS) + 'T23:59:59+01:00' } };
  });
  const result = useFeedRows({ source: { _eq: 'appointment' }, ...range });

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
        {result.status === 'success' && <Lists rows={result.data} contactId={contactId} now={now} />}
      </CardContent>
    </Card>
  );
}

function Lists({ rows, contactId, now }: { rows: FeedRow[]; contactId: string; now: number }) {
  const { upcoming, past } = split(rows, contactId, now);
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
