// FullCalendar skin for the calendar: tokens only, so the palette and dark mode apply. Events carry the
// appointment type as a coloured start edge (mirrored in Arabic by logical properties), status as opacity.
export const CALENDAR_STYLES = `
.erp-calendar .fc {
  --fc-border-color: var(--border);
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: var(--muted);
  --fc-neutral-text-color: var(--muted-foreground);
  --fc-today-bg-color: color-mix(in oklch, var(--primary) 8%, transparent);
  --fc-now-indicator-color: var(--destructive);
  --fc-list-event-hover-bg-color: var(--muted);
  color: var(--foreground);
  font-size: 0.875rem;
}
.erp-calendar .fc-scrollgrid { border-radius: var(--radius-lg); overflow: hidden; }
.erp-calendar .fc-col-header-cell-cushion { padding: 0.625rem 0; font-weight: 500; color: var(--muted-foreground); }
.erp-calendar .fc-daygrid-day-number { padding: 0.375rem 0.5rem; font-variant-numeric: tabular-nums; }
.erp-calendar .fc-day-other .fc-daygrid-day-number { color: var(--muted-foreground); opacity: 0.6; }
.erp-calendar .fc-timegrid-slot-label-cushion,
.erp-calendar .fc-timegrid-axis-cushion { color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
.erp-calendar .fc-event {
  --kind: var(--primary);
  border: 0;
  border-inline-start: 3px solid var(--kind);
  border-radius: 0.5rem;
  background: color-mix(in oklch, var(--kind) 12%, var(--card));
  color: var(--foreground);
  padding: 2px 6px;
  cursor: pointer;
  transition: background-color 150ms ease, box-shadow 150ms ease;
}
.erp-calendar .fc-event:hover { background: color-mix(in oklch, var(--kind) 20%, var(--card)); }
.erp-calendar .fc-event:focus-visible { outline: 3px solid color-mix(in oklch, var(--ring) 50%, transparent); outline-offset: 2px; }
.erp-calendar .fc-event-time { font-variant-numeric: tabular-nums; font-weight: 600; }
.erp-calendar .fc-event-title { font-weight: 500; }
.erp-calendar .fc-daygrid-event { margin: 1px 3px; }
.erp-calendar .fc-list-event-dot { display: none; }
.erp-calendar .fc-list-event td { padding-block: 0.5rem; }
.erp-calendar .ev-viewing { --kind: var(--info); }
.erp-calendar .ev-move_in { --kind: var(--success); }
.erp-calendar .ev-move_out { --kind: var(--warning); }
.erp-calendar .ev-meeting { --kind: var(--primary); }
.erp-calendar .ev-other { --kind: var(--muted-foreground); }
.erp-calendar .ev-lease { --kind: var(--chart-2); }
.erp-calendar .ev-status-done { opacity: 0.7; }
.erp-calendar .ev-status-cancelled { opacity: 0.5; text-decoration: line-through; border-inline-start-style: dashed; }
`;
