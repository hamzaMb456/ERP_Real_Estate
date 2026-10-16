'use client';

import { useMemo } from 'react';
import { generateTheme } from '@/theme/generate';
import { seedOf, type Selection } from '@/theme/palettes';

/** A miniature of the app (sidebar, page, card, button, accent) painted from the tokens a selection generates. */
export function PaletteSwatch({ selection, mode }: { selection: Selection; mode: 'light' | 'dark' }) {
  const tokens = useMemo(() => generateTheme(seedOf(selection))[mode], [selection, mode]);
  return (
    <div
      aria-hidden
      className="flex h-16 w-full overflow-hidden rounded-lg border"
      style={{ background: tokens['--background'], borderColor: tokens['--border'] }}
    >
      <div
        className="w-1/5 shrink-0"
        style={{ backgroundImage: `linear-gradient(180deg, ${tokens['--sidebar-grad-top']}, ${tokens['--sidebar-grad-bottom']})` }}
      />
      <div className="flex flex-1 flex-col justify-center gap-1.5 p-2">
        <div className="h-5 rounded" style={{ background: tokens['--card'], boxShadow: `0 0 0 1px ${tokens['--border']}` }} />
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-9 rounded-full" style={{ background: tokens['--primary'] }} />
          <span className="size-3 rounded-full" style={{ background: tokens['--chart-1'] }} />
          <span className="size-3 rounded-full" style={{ background: tokens['--accent-foreground'] }} />
        </div>
      </div>
    </div>
  );
}
