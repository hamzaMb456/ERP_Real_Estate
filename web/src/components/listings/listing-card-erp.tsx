'use client';

import { useState } from 'react';
import { ExternalLink, Pencil, Plus } from '@/components/icons';
import { ListingForm } from '@/components/listings/listing-form';
import { Pulse } from '@/components/motion/primitives';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTnd } from '@/lib/format';
import { defaultKindFor, kindsFor, type ListingKind, type ListingRecord, type ListingStatus } from '@/lib/listings';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';

// A unit has at most one open (not closed) listing per kind; closed ones are history and are not shown here.
const QUERY = `
  query UnitListings($unitId: uuid!) {
    listings(where: { unit_id: { _eq: $unitId }, status: { _neq: "closed" } }, order_by: [{ created_at: asc }]) {
      id kind status title description price charges deposit_months reservation_deposit reservation_days
      available_from furnished amenities virtual_tour_url
    }
  }
`;

const STATUS_CLASS: Record<ListingStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-success/12 text-success',
  paused: 'bg-warning/15 text-warning',
  closed: 'bg-muted text-muted-foreground',
};

function ListingStatusChip({ status }: { status: ListingStatus }) {
  const t = useT();
  return (
    <Badge variant="secondary" className={cn('h-6 gap-1.5 px-2.5', STATUS_CLASS[status])}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {t.listings.statuses[status]}
    </Badge>
  );
}

/** Kinds still free for this unit, the one matching its status first. */
function freeKinds(unitStatus: string, open: ListingRecord[]): ListingKind[] {
  const preferred = defaultKindFor(unitStatus);
  return kindsFor(unitStatus)
    .filter((kind) => !open.some((listing) => listing.kind === kind))
    .sort((a, b) => Number(b === preferred) - Number(a === preferred));
}

/** « Publication » card of the unit page: its open listings (draft, published, paused) and the form to publish. */
export function ListingCardErp({ unitId, unitStatus }: { unitId: string; unitStatus: string }) {
  const t = useT();
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const result = useGraphql<{ listings: ListingRecord[] }>(QUERY, { unitId }, reload);

  const saved = () => {
    setEditing(null);
    setCreating(false);
    setReload((value) => value + 1);
  };

  const open = result.status === 'success' ? result.data.listings : [];
  const kinds = freeKinds(unitStatus, open);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t.listings.card.title}</CardTitle>
        <CardDescription>{t.listings.card.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {result.status === 'loading' && <Pulse className="text-muted-foreground">{t.listings.card.loading}</Pulse>}
        {result.status === 'error' && (
          <p role="alert" className="text-destructive">
            {t.listings.card.loadError(result.message)}
          </p>
        )}

        {result.status === 'success' && open.length === 0 && !creating && (
          <p className="text-muted-foreground">{kindsFor(unitStatus).length === 0 ? t.listings.card.noKinds : t.listings.card.none}</p>
        )}

        {open.map((listing) => (
          <div key={listing.id} className="space-y-4 rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <ListingStatusChip status={listing.status} />
                  <Badge variant="outline">{t.listings.kinds[listing.kind]}</Badge>
                </div>
                <p className="truncate font-medium">{listing.title || t.listings.card.untitled}</p>
                <p className="text-muted-foreground tabular-nums">{formatTnd(listing.price)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!canEdit && listing.status === 'published' && (
                  <Button asChild variant="ghost" size="sm">
                    <a href={'/logement/' + listing.id} target="_blank" rel="noopener noreferrer">
                      <ExternalLink data-icon="inline-start" className="rtl:-scale-x-100" />
                      {t.listings.card.viewOnSite}
                    </a>
                  </Button>
                )}
                {canEdit && (
                  <Button variant="outline" size="sm" aria-expanded={editing === listing.id} onClick={() => setEditing(editing === listing.id ? null : listing.id)}>
                    <Pencil data-icon="inline-start" />
                    {editing === listing.id ? t.listings.card.hideForm : t.listings.card.edit}
                  </Button>
                )}
              </div>
            </div>
            {canEdit && editing === listing.id && (
              <ListingForm key={listing.id + ':' + listing.status} unitId={unitId} kinds={[listing.kind]} listing={listing} onSaved={saved} onCancel={() => setEditing(null)} />
            )}
          </div>
        ))}

        {canEdit && creating && kinds.length > 0 && (
          <div className="rounded-lg border p-3">
            <ListingForm unitId={unitId} kinds={kinds} onSaved={saved} onCancel={() => setCreating(false)} />
          </div>
        )}

        {canEdit && result.status === 'success' && !creating && kinds.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus data-icon="inline-start" />
            {t.listings.card.create}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
