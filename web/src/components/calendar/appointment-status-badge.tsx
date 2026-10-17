import { Badge } from '@/components/ui/badge';
import { useT } from '@/i18n/provider';
import type { AppointmentStatus } from '@/lib/appointment-types';
import { cn } from '@/lib/utils';

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  planned: 'bg-info/10 text-info',
  done: 'bg-success/12 text-success',
  cancelled: 'bg-muted text-muted-foreground line-through',
};

/** Status pill with a leading dot, per the badge recipe (same shape as the lease status badge). */
export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const t = useT();
  return (
    <Badge variant="secondary" className={cn('h-6 gap-1.5 px-2.5', STATUS_CLASS[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t.calendar.statuses[status] ?? status}
    </Badge>
  );
}

/** Neutral pill for the appointment kind. */
export function AppointmentKindBadge({ label }: { label: string }) {
  return (
    <Badge variant="secondary" className="h-6 bg-muted px-2.5 text-muted-foreground">
      {label}
    </Badge>
  );
}
