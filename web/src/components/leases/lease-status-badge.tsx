import { Badge } from '@/components/ui/badge';
import { todayTunis } from '@/lib/dates';
import type { LeaseOverviewRow, LeaseStatus } from '@/lib/lease-types';
import { leaseFlags, type LeaseFlagTone } from '@/lib/leases';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';
const STATUS_CLASS: Record<LeaseStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-success/12 text-success',
  ended: 'bg-muted text-muted-foreground',
  expired: 'bg-destructive/10 text-destructive',
};

const TONE_CLASS: Record<LeaseFlagTone, string> = {
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/10 text-destructive',
};

export function LeaseStatusBadge({ status }: { status: LeaseStatus }) {
  const t = useT();
  return (
    <Badge variant="secondary" className={cn('h-6 gap-1.5 px-2.5', STATUS_CLASS[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t.leases.statuses[status]}
    </Badge>
  );
}

type FlagRow = Pick<
  LeaseOverviewRow,
  'is_ending_soon' | 'in_grace' | 'grace_days_left' | 'registration_state' | 'registration_deadline' | 'end_date'
> & { status?: LeaseStatus };

export function LeaseFlagBadges({ row }: { row: FlagRow }) {
  const flags = leaseFlags(row, todayTunis());
  return (
    <>
      {flags.map((flag) => (
        <Badge key={flag.key} variant="secondary" className={cn('h-6 px-2.5', TONE_CLASS[flag.tone])}>
          {flag.label}
        </Badge>
      ))}
    </>
  );
}
