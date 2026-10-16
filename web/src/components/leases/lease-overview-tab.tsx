import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { RegistrationCard } from '@/components/leases/registration-card';
import { TermsTimeline } from '@/components/leases/terms-timeline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTnd } from '@/lib/format';
import { todayTunis } from '@/lib/dates';
import { isPastGrace } from '@/lib/leases';
import { formatDate } from '@/lib/ownership';

import { useT } from '@/i18n/provider';
type Props = { lease: LeaseDetails; canEdit: boolean; onChanged: () => void };

export function LeaseOverviewTab({ lease, canEdit, onChanged }: Props) {
  const t = useT();
  const renters = lease.parties.filter((party) => party.role === 'renter');
  const guarantors = lease.parties.filter((party) => party.role === 'guarantor');
  const owners = new Map<string, { name: string; units: string[] }>();
  for (const { unit } of lease.units) {
    for (const owner of unit.current_owners) {
      const entry = owners.get(owner.contact.id) ?? { name: owner.contact.full_name, units: [] };
      entry.units.push(unit.code);
      owners.set(owner.contact.id, entry);
    }
  }

  return (
    <div className="space-y-6">
      {lease.overview?.in_grace && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <p>
            {t.leases.overview.graceNotice(formatDate(lease.end_date), lease.overview.grace_days_left ?? 0)}
          </p>
        </div>
      )}

      {isPastGrace({ status: lease.status, end_date: lease.end_date, in_grace: lease.overview?.in_grace ?? false }, todayTunis()) && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>
            {t.leases.overview.pastGraceNotice(formatDate(lease.end_date))}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.leases.overview.conditions}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{t.leases.overview.period}</dt>
                <dd className="font-medium">
                  {formatDate(lease.start_date)} {t.common.arrow} {formatDate(lease.end_date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{t.leases.overview.payDay}</dt>
                <dd className="font-medium">{t.leases.overview.payDayValue(lease.payment_day)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{t.leases.overview.deposit}</dt>
                <dd className="font-medium tabular-nums">{formatTnd(lease.deposit_amount)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">{t.leases.overview.signedOn}</dt>
                <dd className="font-medium">{lease.signed_at ? formatDate(lease.signed_at) : '—'}</dd>
              </div>
              {lease.ended_on && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">{t.leases.overview.leaseEnd}</dt>
                  <dd className="font-medium">
                    {t.common.on(formatDate(lease.ended_on))}
                    {lease.end_reason ? ' · ' + t.leases.endReasons[lease.end_reason] : ''}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.leases.overview.partiesTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[...renters.map((party) => ({ ...party, label: t.leases.overview.renter })), ...guarantors.map((party) => ({ ...party, label: t.leases.overview.guarantor }))].map((party) => (
              <div key={party.contact.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={'/contacts/' + party.contact.id} className="font-medium text-primary hover:underline">
                    {party.contact.full_name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{[party.contact.phone, party.contact.email].filter(Boolean).join(' · ') || t.leases.overview.noContactInfo}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{party.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.leases.overview.units}</CardTitle>
            <CardDescription>{t.leases.overview.unitsDescription}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y text-sm">
            {lease.units.map(({ unit }) => {
              const rent = lease.current_rents.find((item) => item.unit_id === unit.id);
              return (
                <div key={unit.id} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div>
                    <Link href={`/biens/${unit.property.id}/unites/${unit.id}`} className="font-medium text-primary hover:underline">
                      {unit.code}
                    </Link>
                    <p className="text-xs text-muted-foreground">{unit.property.name}</p>
                  </div>
                  <div className="text-end tabular-nums">
                    <p className="font-medium">{rent ? formatTnd(rent.rent_amount) : '—'}</p>
                    {rent && Number(rent.charges_amount) > 0 && <p className="text-xs text-muted-foreground">{t.leases.overview.plusCharges(formatTnd(rent.charges_amount))}</p>}
                    {rent?.next_change_on && rent.next_rent_amount !== null && (
                      <p className="text-xs text-muted-foreground">
                        {t.leases.overview.nextRent(formatTnd(rent.next_rent_amount), formatDate(rent.next_change_on))}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.leases.overview.landlord}</CardTitle>
            <CardDescription>{t.leases.overview.landlordDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {owners.size === 0 && <p className="text-muted-foreground">{t.leases.overview.noOwner}</p>}
            {[...owners.entries()].map(([id, owner]) => (
              <div key={id} className="flex items-center justify-between gap-3">
                <Link href={'/contacts/' + id} className="font-medium text-primary hover:underline">
                  {owner.name}
                </Link>
                <span className="text-xs text-muted-foreground">{owner.units.join(', ')}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RegistrationCard lease={lease} canEdit={canEdit} onChanged={onChanged} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t.leases.overview.terms}</CardTitle>
          </CardHeader>
          <CardContent>
            <TermsTimeline lease={lease} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
