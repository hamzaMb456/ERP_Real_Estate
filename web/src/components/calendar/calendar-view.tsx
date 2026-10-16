'use client';

import { useEffect, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { isoToTunisParts, tunisToIso } from '@/lib/appointments';
import type { CalendarEventInput } from '@/lib/calendar';
import type { CalendarViewName } from './calendar-types';

// The only file that imports @fullcalendar/*; the page loads it with next/dynamic (ssr: false).
//
// No named-time-zone plugin is installed, so FullCalendar runs in UTC and every timed instant is
// shifted to its Tunis wall clock before it goes in (and shifted back on the way out). Tunis is
// UTC+1 all year, and this keeps the grid right whatever time zone the browser is in.

const STYLES = `
.erp-calendar .fc {
  --fc-border-color: var(--border);
  --fc-page-bg-color: var(--card);
  --fc-neutral-bg-color: var(--muted);
  --fc-neutral-text-color: var(--muted-foreground);
  --fc-today-bg-color: color-mix(in oklch, var(--primary) 10%, transparent);
  --fc-now-indicator-color: var(--destructive);
  --fc-event-bg-color: var(--primary);
  --fc-event-border-color: var(--primary);
  --fc-event-text-color: var(--primary-foreground);
  --fc-list-event-hover-bg-color: var(--muted);
  --fc-button-bg-color: var(--secondary);
  --fc-button-border-color: var(--border);
  --fc-button-text-color: var(--secondary-foreground);
  --fc-button-hover-bg-color: var(--accent);
  --fc-button-hover-border-color: var(--border);
  --fc-button-active-bg-color: var(--primary);
  --fc-button-active-border-color: var(--primary);
  color: var(--foreground);
  font-size: 0.875rem;
}
.erp-calendar .fc-button-primary:not(:disabled):active,
.erp-calendar .fc-button-primary:not(:disabled).fc-button-active { color: var(--primary-foreground); }
.erp-calendar .fc-toolbar { flex-wrap: wrap; gap: 0.5rem; }
.erp-calendar .fc-toolbar-title { font-size: 1.125rem; text-transform: capitalize; }
.erp-calendar a { color: inherit; text-decoration: none; }
.erp-calendar .fc-event { cursor: pointer; }
.erp-calendar .ev-lease {
  --fc-event-bg-color: color-mix(in oklch, var(--info) 18%, var(--card));
  --fc-event-border-color: var(--info);
  --fc-event-text-color: var(--foreground);
}
.erp-calendar .ev-status-done { opacity: 0.7; }
.erp-calendar .ev-status-cancelled { opacity: 0.5; text-decoration: line-through; }
`;

const DEFAULT_SLOT_TIME = '09:00';

/** The Tunis wall clock of an instant, without offset: what the UTC-based grid must be given. */
function wallClock(iso: string): string {
  const { date, time } = isoToTunisParts(iso);
  return `${date}T${time}:00`;
}

/** FullCalendar's own start string (wall clock, or a bare day) back to a real instant. */
function slotToIso(startStr: string): string {
  const time = startStr.length > 10 ? startStr.slice(11, 16) : DEFAULT_SLOT_TIME;
  return tunisToIso(startStr.slice(0, 10), time);
}

const dayOf = (date: Date): string => date.toISOString().slice(0, 10);
const tunisNow = (): Date => new Date(Date.now() + 60 * 60 * 1000);

type Props = {
  events: CalendarEventInput[];
  view: CalendarViewName;
  date: string;
  onViewChange: (view: CalendarViewName) => void;
  onDateChange: (date: string) => void;
  onEventClick: (id: string) => void;
  /** Without it the grid is read-only: nobody can start an appointment by selecting a slot. */
  onSelectSlot?: (startIso: string) => void;
};

export default function CalendarView({ events, view, date, onViewChange, onDateChange, onEventClick, onSelectSlot }: Props) {
  const calendar = useRef<FullCalendar>(null);
  const shown = useMemo(
    () => events.map((event) => (event.allDay ? event : { ...event, start: wallClock(event.start), end: wallClock(event.end) })),
    [events],
  );

  // The URL is the source of truth: follow it when it changes from outside (reload, back button).
  useEffect(() => {
    const api = calendar.current?.getApi();
    if (!api) return;
    if (api.view.type !== view) api.changeView(view);
    if (dayOf(api.getDate()) !== date) api.gotoDate(date);
  }, [view, date]);

  return (
    <div className="erp-calendar overflow-hidden rounded-xl border bg-card p-2 sm:p-4">
      <style>{STYLES}</style>
      <FullCalendar
        ref={calendar}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locales={[frLocale]}
        locale="fr"
        timeZone="UTC"
        now={tunisNow}
        firstDay={1}
        initialView={view}
        initialDate={date}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }}
        buttonText={{ today: 'Aujourd’hui', month: 'Mois', week: 'Semaine', list: 'Liste' }}
        height="auto"
        fixedWeekCount={false}
        nowIndicator
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        scrollTime="08:00:00"
        allDayText="Journée"
        noEventsText="Aucun rendez-vous sur cette période."
        events={shown}
        selectable={onSelectSlot !== undefined}
        select={(info) => {
          onSelectSlot?.(slotToIso(info.startStr));
          info.view.calendar.unselect();
        }}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          onEventClick(info.event.id);
        }}
        datesSet={(info) => {
          const type = info.view.type as CalendarViewName;
          const current = dayOf(info.view.calendar.getDate());
          if (type !== view) onViewChange(type);
          if (current !== date) onDateChange(current);
        }}
      />
    </div>
  );
}
