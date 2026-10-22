'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type { LocaleInput } from '@fullcalendar/core';
import arLocale from '@fullcalendar/core/locales/ar-tn';
import enLocale from '@fullcalendar/core/locales/en-gb';
import frLocale from '@fullcalendar/core/locales/fr';
import type { Locale } from '@/i18n/config';
import { useI18n } from '@/i18n/provider';
import { isoToTunisParts, tunisToIso } from '@/lib/appointments';
import type { CalendarEventInput } from '@/lib/calendar';
import { CALENDAR_STYLES } from './calendar-view-styles';
import type { CalendarViewName } from './calendar-types';
import { CalendarToolbar } from './calendar-toolbar';

// The only file that imports @fullcalendar/*; the page loads it with next/dynamic (ssr: false).
//
// No named-time-zone plugin is installed, so FullCalendar runs in UTC and every timed instant is
// shifted to its Tunis wall clock before it goes in (and shifted back on the way out). Tunis is
// UTC+1 all year, and this keeps the grid right whatever time zone the browser is in.

/**
 * FullCalendar locale per interface language: day and month names, week numbering. Arabic uses the Tunisian
 * variant so dates keep Latin digits like the rest of the app (ar-TN); every visible text comes from our dictionary.
 */
const FC_LOCALES: Record<Locale, LocaleInput> = { fr: frLocale, en: enLocale, ar: arLocale };

const DEFAULT_SLOT_TIME = '09:00';
/** Monday, for every language (DESIGN: weeks start on Monday). */
const FIRST_DAY_MONDAY = 1;

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
  const { locale, dir, t } = useI18n();
  const v = t.calendar.view;
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

  // The period title (« octobre 2026 ») comes from FullCalendar; our toolbar shows it.
  const [title, setTitle] = useState('');
  const api = () => calendar.current?.getApi();

  const fcLocale = FC_LOCALES[locale];

  return (
    <div className="erp-calendar space-y-4" role="region" aria-label={v.label}>
      <style>{CALENDAR_STYLES}</style>
      <CalendarToolbar
        view={view}
        title={title}
        date={date}
        onViewChange={onViewChange}
        onPrev={() => api()?.prev()}
        onNext={() => api()?.next()}
        onToday={() => api()?.today()}
        onPickDate={(iso) => api()?.gotoDate(iso)}
      />
      <FullCalendar
        ref={calendar}
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        locales={[fcLocale]}
        locale={fcLocale.code}
        direction={dir}
        timeZone="UTC"
        now={tunisNow}
        firstDay={FIRST_DAY_MONDAY}
        initialView={view}
        initialDate={date}
        // The toolbar above is ours (shadcn), so FullCalendar draws no header of its own.
        headerToolbar={false}
        viewHint={v.viewHint}
        navLinkHint={v.navLinkHint}
        moreLinkText={v.moreLink}
        moreLinkHint={v.moreLinkHint}
        closeHint={v.closeHint}
        timeHint={v.timeHint}
        eventHint={v.eventHint}
        allDayText={v.allDay}
        noEventsText={v.noEvents}
        height="auto"
        fixedWeekCount={false}
        nowIndicator
        slotMinTime="07:00:00"
        slotMaxTime="21:00:00"
        scrollTime="08:00:00"
        events={shown}
        selectable={onSelectSlot !== undefined}
        select={(info) => {
          onSelectSlot?.(slotToIso(info.startStr));
          info.view.calendar.unselect();
        }}
        // Focusable events (tabindex 0) that Enter and Space activate, named as buttons for screen readers.
        // FullCalendar already turns this on when an eventClick handler exists; saying it keeps it from
        // depending on that detection.
        eventInteractive
        eventDidMount={(info) => info.el.setAttribute('role', 'button')}
        eventClick={(info) => {
          info.jsEvent.preventDefault();
          onEventClick(info.event.id);
        }}
        datesSet={(info) => {
          setTitle(info.view.title);
          const type = info.view.type as CalendarViewName;
          const current = dayOf(info.view.calendar.getDate());
          if (type !== view) onViewChange(type);
          if (current !== date) onDateChange(current);
        }}
      />
    </div>
  );
}
