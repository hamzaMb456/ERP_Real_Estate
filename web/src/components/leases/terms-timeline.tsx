import { formatDateFr } from '@/lib/ownership';
import type { LeaseDetails } from '@/components/leases/lease-details';

type Props = { lease: Pick<LeaseDetails, 'status' | 'start_date' | 'end_date' | 'terms'> };

/** Initial term then each renewal. A draft has no term row yet: its planned period is shown. */
export function TermsTimeline({ lease }: Props) {
  const rows =
    lease.terms.length > 0
      ? lease.terms
      : [{ id: 'planned', kind: 'initial' as const, start_date: lease.start_date, end_date: lease.end_date, note: null }];
  return (
    <ol className="space-y-3">
      {rows.map((term) => (
        <li key={term.id} className="flex gap-3">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <div>
            <p className="text-sm font-medium">
              {term.kind === 'renewal' ? 'Renouvellement' : lease.status === 'draft' ? 'Durée prévue' : 'Durée initiale'}
            </p>
            <p className="text-sm text-muted-foreground">
              Du {formatDateFr(term.start_date)} au {formatDateFr(term.end_date)}
              {term.note ? ' · ' + term.note : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
