'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { RequestBoard } from '@/components/requests/request-board';
import { RequestCard } from '@/components/requests/request-card';
import { RequestProgress } from '@/components/requests/request-progress';
import { saveRentalNote, setRentalStatus } from '@/components/requests/request-mutations';
import { requestTone, useRequestAction } from '@/components/requests/use-request-action';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/ownership';
import { matchesRequest, RENTAL_STATUSES, rentalProgress, type RentalRequest, type RentalStatus } from '@/lib/requests';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';

const RENTAL_REQUESTS_QUERY = `
  query RentalRequests {
    rental_requests(order_by: { created_at: desc }, limit: 500) {
      id full_name phone email message staff_note created_at start_date duration_months status closed_outcome
      unit { id code title property { id name city } }
    }
  }
`;

type Step = { to: RentalStatus; label: 'markContacted' | 'accept' | 'decline' | 'close' | 'reopen'; primary?: boolean };

/** What a manager can do next from each status (a refused or closed request can be reopened). */
const NEXT_STEPS: Record<RentalStatus, Step[]> = {
  new: [
    { to: 'contacted', label: 'markContacted', primary: true },
    { to: 'accepted', label: 'accept' },
    { to: 'declined', label: 'decline' },
  ],
  contacted: [
    { to: 'accepted', label: 'accept', primary: true },
    { to: 'declined', label: 'decline' },
    { to: 'closed', label: 'close' },
  ],
  accepted: [{ to: 'closed', label: 'close' }],
  declined: [{ to: 'new', label: 'reopen' }],
  closed: [{ to: 'new', label: 'reopen' }],
};

/** « Demandes de location »: the rental requests visitors send from the public site. A fixed route so it is not read as a lease id. */
export default function RentalRequestsPage() {
  const t = useT();
  const text = t.requests;
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const result = useGraphql<{ rental_requests: RentalRequest[] }>(RENTAL_REQUESTS_QUERY, undefined, reload);
  const requests: { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: RentalRequest[] } =
    result.status === 'success' ? { status: 'success', data: result.data.rental_requests } : result;
  const refresh = useCallback(() => setReload((value) => value + 1), []);
  const { busyId, run } = useRequestAction(refresh, text.card.updateFailed);
  const fresh = result.status === 'success' ? result.data.rental_requests.filter((request) => request.status === 'new').length : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={text.rental.title}
        description={result.status === 'success' ? text.rental.description(result.data.rental_requests.length, fresh) : text.loading}
      />
      <RequestBoard<RentalRequest>
        result={requests}
        statuses={RENTAL_STATUSES}
        statusLabel={(status) => text.rental.statuses[status as RentalStatus]}
        filterLabel={text.rental.title}
        matches={matchesRequest}
        emptyTitle={text.rental.emptyTitle}
        emptyBody={text.rental.emptyBody}
        renderCard={(request) => (
          <RequestCard
            key={request.id}
            request={request}
            statusLabel={text.rental.statuses[request.status]}
            tone={requestTone(request.status)}
            progress={<RequestProgress outcome={rentalProgress(request.status, request.closed_outcome)} />}
            onSaveNote={(note) => saveRentalNote(request.id, note).then(refresh)}
            details={
              <p className="text-muted-foreground">
                {text.rental.startDate} : <span className="font-medium text-foreground">{formatDate(request.start_date)}</span>
                {' · '}
                {text.rental.duration} : <span className="font-medium text-foreground">{text.rental.durationMonths(request.duration_months)}</span>
              </p>
            }
            actions={
              canEdit && (
                <>
                  {NEXT_STEPS[request.status].map((step) => (
                    <Button
                      key={step.to}
                      size="sm"
                      variant={step.primary ? 'default' : 'outline'}
                      disabled={busyId === request.id}
                      onClick={() => void run(request.id, () => setRentalStatus(request.id, step.to), text.rental.updated)}
                    >
                      {text.rental[step.label]}
                    </Button>
                  ))}
                  {request.status === 'accepted' && (
                    <Button asChild size="sm">
                      <Link href={`/erp/baux/nouveau?unite=${request.unit.id}`}>{text.rental.createLease}</Link>
                    </Button>
                  )}
                </>
              )
            }
          />
        )}
      />
    </div>
  );
}
