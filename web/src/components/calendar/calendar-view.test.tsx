import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CalendarEventInput } from '@/lib/calendar';
import CalendarView from './calendar-view';

// Smoke test: FullCalendar only renders in a real DOM, so this guards against import or runtime crashes
// (plugins, French locale, the Tunis wall-clock shift). The grid itself is checked in the browser.
const events: CalendarEventInput[] = [
  {
    id: 'a:1',
    title: 'Visite B-102',
    start: '2026-10-16T10:00:00+01:00',
    end: '2026-10-16T10:30:00+01:00',
    allDay: false,
    classNames: ['ev-appointment'],
    extendedProps: { source: 'appointment', kind: 'viewing', appointmentId: '1', leaseId: null, unitId: null, status: 'planned' },
  },
  {
    id: 'l:2:3:lease_end',
    title: 'Fin du bail · Bail 12',
    start: '2026-10-20',
    end: '2026-10-21',
    allDay: true,
    classNames: ['ev-lease'],
    extendedProps: { source: 'lease', kind: 'lease_end', appointmentId: null, leaseId: '2', unitId: '3', status: 'active' },
  },
];

describe('CalendarView', () => {
  it('shows the month in French with the timed and the all-day event', () => {
    render(
      <CalendarView
        events={events}
        view="dayGridMonth"
        date="2026-10-16"
        onViewChange={() => {}}
        onDateChange={() => {}}
        onEventClick={() => {}}
      />,
    );
    expect(screen.getByText(/octobre 2026/i)).toBeInTheDocument();
    expect(screen.getByText('Visite B-102')).toBeInTheDocument();
    expect(screen.getByText('Fin du bail · Bail 12')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Semaine' })).toBeInTheDocument();
  });

  it('reports the clicked event id', async () => {
    const onEventClick = vi.fn();
    render(
      <CalendarView
        events={events}
        view="dayGridMonth"
        date="2026-10-16"
        onViewChange={() => {}}
        onDateChange={() => {}}
        onEventClick={onEventClick}
      />,
    );
    await userEvent.click(screen.getByText('Visite B-102'));
    expect(onEventClick).toHaveBeenCalledWith('a:1');
  });
  describe('keyboard access', () => {
    const renderView = (onEventClick = vi.fn()) => {
      render(
        <CalendarView
          events={events}
          view="dayGridMonth"
          date="2026-10-16"
          onViewChange={() => {}}
          onDateChange={() => {}}
          onEventClick={onEventClick}
        />,
      );
      return onEventClick;
    };
    const eventElement = (title: string) => screen.getByText(title).closest('.fc-event') as HTMLElement;

    it('puts the events in the tab order', () => {
      renderView();
      for (const title of ['Visite B-102', 'Fin du bail · Bail 12']) {
        expect(eventElement(title)).toHaveAttribute('tabindex', '0');
      }
    });

    it('exposes the events to screen readers as buttons', () => {
      renderView();
      expect(screen.getByRole('button', { name: /Visite B-102/ })).toBe(eventElement('Visite B-102'));
      expect(screen.getByRole('button', { name: /Fin du bail · Bail 12/ })).toBe(eventElement('Fin du bail · Bail 12'));
    });

    it('reports the event id when Enter is pressed on a focused event', async () => {
      const onEventClick = renderView();
      const user = userEvent.setup();
      eventElement('Visite B-102').focus();
      expect(eventElement('Visite B-102')).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(onEventClick).toHaveBeenCalledWith('a:1');
    });

    it('reports the event id when Space is pressed on a focused event', async () => {
      const onEventClick = renderView();
      const user = userEvent.setup();
      eventElement('Fin du bail · Bail 12').focus();
      await user.keyboard(' ');
      expect(onEventClick).toHaveBeenCalledWith('l:2:3:lease_end');
    });
  });
});
