// FullCalendar skin for the calendar: tokens only, so the palette and dark mode apply. Kept apart from the
// component so the component file stays about the behaviour.

export const CALENDAR_STYLES = `
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
