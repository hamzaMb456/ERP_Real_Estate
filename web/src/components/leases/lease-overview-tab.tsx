import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import type { LeaseDetails } from '@/components/leases/lease-details';
import { RegistrationCard } from '@/components/leases/registration-card';
import { TermsTimeline } from '@/components/leases/terms-timeline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatTnd } from '@/lib/format';
import { todayTunis } from '@/lib/dates';
import { END_REASON_LABELS, isPastGrace } from '@/lib/leases';
import { formatDateFr } from '@/lib/ownership';

type Props = { lease: LeaseDetails; canEdit: boolean; onChanged: () => void };

export function LeaseOverviewTab({ lease, canEdit, onChanged }: Props) {
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
            Ce bail est échu depuis le {formatDateFr(lease.end_date)}. Renouvelez-le ou terminez-le : il expirera automatiquement dans{' '}
            {lease.overview.grace_days_left ?? 0} jour(s) et ses unités seront libérées.
          </p>
        </div>
      )}

      {isPastGrace({ status: lease.status, end_date: lease.end_date, in_grace: lease.overview?.in_grace ?? false }, todayTunis()) && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <p>
            Ce bail est échu depuis le {formatDateFr(lease.end_date)} et la semaine de grâce est passée. Renouvelez-le ou terminez-le : son unité reste marquée louée tant que le bail est actif.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Période</dt>
                <dd className="font-medium">
                  {formatDateFr(lease.start_date)} → {formatDateFr(lease.end_date)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Jour de paiement</dt>
                <dd className="font-medium">Le {lease.payment_day} de chaque mois</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Dépôt de garantie</dt>
                <dd className="font-medium tabular-nums">{formatTnd(lease.deposit_amount)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground">Signé le</dt>
                <dd className="font-medium">{lease.signed_at ? formatDateFr(lease.signed_at) : '—'}</dd>
              </div>
              {lease.ended_on && (
                <div className="col-span-2">
                  <dt className="text-xs font-medium text-muted-foreground">Fin du bail</dt>
                  <dd className="font-medium">
                    Le {formatDateFr(lease.ended_on)}
                    {lease.end_reason ? ' · ' + END_REASON_LABELS[lease.end_reason] : ''}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Locataires et garants</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[...renters.map((party) => ({ ...party, label: 'Locataire' })), ...guarantors.map((party) => ({ ...party, label: 'Garant' }))].map((party) => (
              <div key={party.contact.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={'/contacts/' + party.contact.id} className="font-medium text-primary hover:underline">
                    {party.contact.full_name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{[party.contact.phone, party.contact.email].filter(Boolean).join(' · ') || 'Aucune coordonnée'}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{party.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unités</CardTitle>
            <CardDescription>Loyer et charges en vigueur aujourd’hui.</CardDescription>
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
                  <div className="text-right tabular-nums">
                    <p className="font-medium">{rent ? formatTnd(rent.rent_amount) : '—'}</p>
                    {rent && Number(rent.charges_amount) > 0 && <p className="text-xs text-muted-foreground">+ {formatTnd(rent.charges_amount)} de charges</p>}
                    {rent?.next_change_on && rent.next_rent_amount !== null && (
                      <p className="text-xs text-muted-foreground">
                        {formatTnd(rent.next_rent_amount)} dès le {formatDateFr(rent.next_change_on)}
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
            <CardTitle className="text-base">Bailleur</CardTitle>
            <CardDescription>Propriétaire actuel des unités louées.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {owners.size === 0 && <p className="text-muted-foreground">Aucun propriétaire renseigné.</p>}
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
            <CardTitle className="text-base">Durées</CardTitle>
          </CardHeader>
          <CardContent>
            <TermsTimeline lease={lease} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
