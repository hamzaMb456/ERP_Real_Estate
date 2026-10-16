'use client';

import dynamic from 'next/dynamic';

// FullCalendar needs the browser: load it only there, and keep it out of the main bundle.
export const CalendarViewLazy = dynamic(() => import('./calendar-view'), {
  ssr: false,
  loading: () => <div className="h-[32rem] animate-pulse rounded-xl bg-muted" />,
});
