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
    expect(screen.getByRole('button', { name: 'Semaine' })).toBeInTheDocument();
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
});
