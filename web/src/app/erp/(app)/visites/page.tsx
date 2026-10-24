'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { RequestBoard } from '@/components/requests/request-board';
import { RequestCard } from '@/components/requests/request-card';
import { closeVisit, confirmVisit, isSlotTaken, saveVisitNote, setVisitStatus } from '@/components/requests/request-mutations';
import { requestTone, useRequestAction } from '@/components/requests/use-request-action';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/ownership';
import { matchesRequest, requestUnitHeading, shortTime, VISIT_STATUSES, type VisitRequest, type VisitStatus } from '@/lib/requests';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';

const VISIT_REQUESTS_QUERY = `
  query VisitRequests {
    visit_requests(order_by: { created_at: desc }, limit: 500) {
      id full_name phone email message staff_note created_at visit_date visit_time status appointment_id
      unit { id code title property { id name city } }
    }
  }
`;

/** « Visites »: the visit requests visitors send from the public site; confirming one books it in the calendar. */
export default function VisitsPage() {
  const t = useT();
  const text = t.requests;
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const result = useGraphql<{ visit_requests: VisitRequest[] }>(VISIT_REQUESTS_QUERY, undefined, reload);
  const requests: { status: 'loading' } | { status: 'error'; message: string } | { status: 'success'; data: VisitRequest[] } =
    result.status === 'success' ? { status: 'success', data: result.data.visit_requests } : result;
  const refresh = useCallback(() => setReload((value) => value + 1), []);
  const describeError = useCallback((error: unknown) => (isSlotTaken(error) ? text.visit.slotTaken : null), [text.visit.slotTaken]);
  const { busyId, run } = useRequestAction(refresh, text.card.updateFailed, describeError);
  const fresh = result.status === 'success' ? result.data.visit_requests.filter((request) => request.status === 'new').length : 0;

  const actionsOf = (request: VisitRequest, status: VisitStatus) => {
    const busy = busyId === request.id;
    const set = (to: VisitStatus) => void run(request.id, () => setVisitStatus(request.id, to), text.visit.updated);
    if (status === 'new') {
      return (
        <>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(
                request.id,
                () => confirmVisit(request, text.visit.appointmentTitle(requestUnitHeading(request.unit), request.full_name)),
                text.visit.confirmed,
              )
            }
          >
            {text.visit.confirm}
          </Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => set('declined')}>
            {text.visit.decline}
          </Button>
        </>
      );
    }
    if (status === 'confirmed') {
      return (
        <>
          <Button size="sm" disabled={busy} onClick={() => void run(request.id, () => closeVisit(request, 'done'), text.visit.updated)}>
            {text.visit.markDone}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void run(request.id, () => closeVisit(request, 'cancelled'), text.visit.updated)}
          >
            {text.visit.cancel}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/erp/calendrier">{text.visit.openCalendar}</Link>
          </Button>
        </>
      );
    }
    if (status === 'declined') {
      return (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => set('new')}>
          {text.visit.reopen}
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={text.visit.title}
        description={result.status === 'success' ? text.visit.description(result.data.visit_requests.length, fresh) : text.loading}
      />
      <RequestBoard<VisitRequest>
        result={requests}
        statuses={VISIT_STATUSES}
        statusLabel={(status) => text.visit.statuses[status as VisitStatus]}
        filterLabel={text.visit.title}
        matches={matchesRequest}
        emptyTitle={text.visit.emptyTitle}
        emptyBody={text.visit.emptyBody}
        renderCard={(request) => (
          <RequestCard
            key={request.id}
            request={request}
            statusLabel={text.visit.statuses[request.status]}
            tone={requestTone(request.status)}
            onSaveNote={(note) => saveVisitNote(request.id, note).then(refresh)}
            details={
              <p className="font-medium text-foreground">{text.visit.when(formatDate(request.visit_date), shortTime(request.visit_time))}</p>
            }
            actions={canEdit && actionsOf(request, request.status)}
          />
        )}
      />
    </div>
  );
}
