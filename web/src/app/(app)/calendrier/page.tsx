'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, Plus } from '@/components/icons';
import { AppointmentDialog } from '@/components/calendar/appointment-dialog';
import { AppointmentEditor } from '@/components/calendar/appointment-editor';
import { AppointmentSheet } from '@/components/calendar/appointment-sheet';
import { CalendarEmptyState } from '@/components/calendar/calendar-empty-state';
import { CalendarFilters } from '@/components/calendar/calendar-filters';
import { EMPTY_FILTERS, type CalendarFilterState, type CalendarViewName } from '@/components/calendar/calendar-types';
import { dateFromParam, paramFromView, viewFromParam, visibleRange } from '@/components/calendar/calendar-url';
import { CalendarViewLazy } from '@/components/calendar/calendar-view-lazy';
import { useCalendarFeed } from '@/components/calendar/use-calendar-feed';
import { useCalendarLookups } from '@/components/calendar/use-calendar-lookups';
import { useContactOptions } from '@/components/ownership/use-contact-options';
import { Pulse } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { tunisToIso } from '@/lib/appointments';
import { filterFeed, toEventInput } from '@/lib/calendar';
import { todayTunis } from '@/lib/dates';
import { useT } from '@/i18n/provider';
import { useCanEdit } from '@/lib/use-can-edit';

/** Updates the query string in place (no navigation); useSearchParams follows. A null value removes the key. */
function setQuery(patch: Record<string, string | null>) {
  const next = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  window.history.replaceState(window.history.state, '', window.location.pathname + (query ? '?' + query : ''));
}

export default function CalendarPage() {
  const t = useT();
  return (
    <Suspense fallback={<Pulse className="text-sm text-muted-foreground">{t.calendar.page.loading}</Pulse>}>
      <CalendarPageBody />
    </Suspense>
  );
}

function CalendarPageBody() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const canEdit = useCanEdit();
  const view = viewFromParam(params.get('vue'));
  const date = dateFromParam(params.get('date'), todayTunis());
  const openedId = params.get('rendezvous');

  const [filters, setFilters] = useState<CalendarFilterState>(EMPTY_FILTERS);
  const [reload, setReload] = useState(0);
  const [creating, setCreating] = useState<{ startsAt: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const feed = useCalendarFeed(visibleRange(view, date), reload);
  const lookups = useCalendarLookups();
  const contacts = useContactOptions();

  const events = useMemo(() => filterFeed(feed.rows, filters).map(toEventInput), [feed.rows, filters]);
  const ready = lookups.status === 'success' && contacts.status === 'success';
  const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);
  const staff = lookups.status === 'success' ? lookups.data.staff : [];
  const branches = lookups.status === 'success' ? lookups.data.branches : [];
  const contactOptions = contacts.status === 'success' ? contacts.data : [];
  const refresh = () => setReload((value) => value + 1);

  function openEvent(eventId: string) {
    const row = feed.rows.find((item) => item.event_id === eventId);
    if (row?.appointment_id) setQuery({ rendezvous: row.appointment_id });
    else if (row?.lease_id) router.push('/baux/' + row.lease_id);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.calendar.page.title}
        description={t.calendar.page.description}
        actions={
          canEdit && (
            <Button disabled={!ready} onClick={() => setCreating({ startsAt: tunisToIso(date, '09:00') })}>
              <Plus data-icon="inline-start" />
              {t.calendar.page.new}
            </Button>
          )
        }
      />

      <Card className="py-4">
        <CardContent>
          <CalendarFilters value={filters} staff={staff} contacts={contactOptions} branches={branches} onChange={setFilters} />
        </CardContent>
      </Card>

      {feed.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.calendar.page.loadError(feed.error)}
        </p>
      )}
      {lookups.status === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {t.calendar.page.lookupsError(lookups.message)}
        </p>
      )}

      <CalendarViewLazy
        events={events}
        view={view}
        date={date}
        onViewChange={(next: CalendarViewName) => setQuery({ vue: paramFromView(next) })}
        onDateChange={(next) => setQuery({ date: next })}
        onEventClick={openEvent}
        onSelectSlot={canEdit && ready ? (startsAt) => setCreating({ startsAt }) : undefined}
      />
      {!feed.loading && !feed.error && events.length === 0 && (
        <CalendarEmptyState
          icon={CalendarDays}
          title={filtered ? t.calendar.page.noMatchTitle : t.calendar.page.emptyTitle}
          body={filtered ? t.calendar.page.noMatchBody : t.calendar.page.emptyBody}
        />
      )}

      <AppointmentSheet
        appointmentId={openedId}
        onOpenChange={(open) => !open && setQuery({ rendezvous: null })}
        onEdit={(id) => {
          setQuery({ rendezvous: null });
          setEditingId(id);
        }}
        onChanged={refresh}
      />

      {creating && (
        <AppointmentDialog
          open
          onOpenChange={(open) => !open && setCreating(null)}
          initial={{ startsAt: creating.startsAt }}
          existing={feed.rows}
          staff={staff}
          contacts={contactOptions}
          onSaved={(id) => {
            refresh();
            setQuery({ rendezvous: id });
          }}
        />
      )}
      {editingId && (
        <AppointmentEditor
          appointmentId={editingId}
          onClose={() => setEditingId(null)}
          existing={feed.rows}
          staff={staff}
          contacts={contactOptions}
          onSaved={(id) => {
            refresh();
            setQuery({ rendezvous: id });
          }}
        />
      )}
    </div>
  );
}
