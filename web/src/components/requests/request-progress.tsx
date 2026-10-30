'use client';

import type { RentalProgress } from '@/lib/requests';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';

const BAR: Record<RentalProgress, { width: string; fill: string; value: number }> = {
  pending: { width: 'w-1/2', fill: 'bg-warning', value: 50 },
  accepted: { width: 'w-full', fill: 'bg-success', value: 100 },
  rejected: { width: 'w-full', fill: 'bg-destructive', value: 100 },
};

/**
 * Where a rental request stands, in three states only (pending, accepted, rejected), as a linear bar: half full while the
 * agency has not decided, full green once accepted, full red once refused. Shown to the client and to the staff.
 */
export function RequestProgress({ outcome, className }: { outcome: RentalProgress; className?: string }) {
  const label = useT().requests.progress[outcome];
  const bar = BAR[outcome];
  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={bar.value}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className={cn('h-full rounded-full transition-all', bar.width, bar.fill)} />
      </div>
    </div>
  );
}
