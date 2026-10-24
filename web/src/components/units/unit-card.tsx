'use client';

import Link from 'next/link';
import { Building2, CircleAlert, Users } from '@/components/icons';
import { StatusBadge } from '@/components/domain/badges';
import { StorageImage } from '@/components/files/storage-image';
import { HoverLift } from '@/components/motion/primitives';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatArea, formatTnd } from '@/lib/format';
import { formatDate } from '@/lib/ownership';
import { unitBlockers, unitHeading, unitPrice, type UnitCardData } from '@/lib/units';
import { cn } from '@/lib/utils';

import { useT } from '@/i18n/provider';

/**
 * Card of a unit in the « Unités » section: the thumbnail, the status and website state on the photo, then the price, the
 * facts, the tenant and, when the unit is not on the website, the reason. The whole card opens the unit page.
 */
export function UnitCard({ unit }: { unit: UnitCardData }) {
  const t = useT();
  const text = t.units.card;
  const blockers = unitBlockers(unit);
  const online = blockers.length === 0;
  const price = unitPrice(unit);
  const hasPrice = price.amount !== null && Number(price.amount) > 0;
  const lease = unit.current_lease[0];
  const heading = unitHeading(unit);
  const cover = unit.photos[0];
  const facts = [
    t.labels.unitTypes[unit.type] ?? unit.type,
    unit.surface_m2 !== null ? formatArea(unit.surface_m2) : null,
    unit.rooms !== null && unit.rooms > 0 ? text.rooms(unit.rooms) : null,
    unit.floor !== null ? text.floor(unit.floor) : null,
  ].filter((fact): fact is string => fact !== null);
  const owners = unit.current_owners.map((owner) => owner.contact.full_name).join(', ');

  return (
    <HoverLift className="h-full rounded-xl">
      <Link href={`/erp/biens/${unit.property.id}/unites/${unit.id}`} aria-label={text.open(heading)} data-scroll-item className="block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <Card className="h-full gap-0 overflow-hidden py-0">
          <div className="relative aspect-[4/3] bg-muted">
            {cover ? (
              <StorageImage fileId={cover.storage_file_id} width={480} alt={heading} className="size-full object-cover" />
            ) : (
              <div className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
                <Building2 className="size-8" aria-hidden />
                <span className="text-xs">{text.noPhoto}</span>
              </div>
            )}
            <span className="absolute start-2 top-2 rounded-full bg-background/90 shadow-sm">
              <StatusBadge status={unit.status} />
            </span>
            <Badge className={cn('absolute end-2 top-2 h-6 gap-1.5 px-2.5 text-white shadow-sm', online ? 'bg-success' : 'bg-foreground/70')}>
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
              {online ? text.online : text.offline}
            </Badge>
          </div>

          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">{heading}</h2>
              <p className="truncate text-xs text-muted-foreground">{[unit.property.city, ...facts].filter(Boolean).join(' · ')}</p>
            </div>

            <p className="text-base font-semibold tabular-nums text-primary">
              {hasPrice ? (
                <>
                  {formatTnd(price.amount)}
                  {price.monthly && <span className="ms-1 text-xs font-normal text-muted-foreground">{text.perMonth}</span>}
                </>
              ) : (
                <span className="text-sm font-normal text-muted-foreground">{text.noPrice}</span>
              )}
            </p>

            <div className="mt-auto space-y-1 border-t pt-2 text-xs text-muted-foreground">
              {lease && (
                <p className="flex items-center gap-1.5">
                  <Users className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{text.tenant(lease.renter_names ?? '—', formatDate(lease.end_date))}</span>
                </p>
              )}
              {owners ? <p className="truncate">{owners}</p> : <p className="font-medium text-warning">{text.noOwner}</p>}
              {!online && (
                <p className="flex items-center gap-1.5 font-medium text-warning">
                  <CircleAlert className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{text.offlineBecause(t.units.blockers[blockers[0]])}</span>
                </p>
              )}
            </div>
          </div>
        </Card>
      </Link>
    </HoverLift>
  );
}
