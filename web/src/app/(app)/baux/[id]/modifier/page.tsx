'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from '@/components/icons';
import { LeaseForm, type LeaseFormInitial } from '@/components/leases/lease-form';
import { Pulse } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import type { LeaseStatus } from '@/lib/lease-types';
import { formatLeaseNumber } from '@/lib/leases';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';
const DRAFT_QUERY = `
  query DraftLease($id: uuid!) {
    lease: leases_by_pk(id: $id) {
      id number status start_date end_date payment_day deposit_amount
      units { unit_id }
      parties { contact_id role }
      rents { unit_id rent_amount charges_amount }
    }
  }
`;

type DraftLease = {
  id: string;
  number: number;
  status: LeaseStatus;
  start_date: string;
  end_date: string;
  payment_day: number;
  deposit_amount: number | string;
  units: { unit_id: string }[];
  parties: { contact_id: string; role: 'renter' | 'guarantor' }[];
  rents: { unit_id: string; rent_amount: number | string; charges_amount: number | string }[];
};

function toInitial(lease: DraftLease): LeaseFormInitial {
  return {
    id: lease.id,
    startDate: lease.start_date,
    endDate: lease.end_date,
    paymentDay: String(lease.payment_day),
    depositAmount: Number(lease.deposit_amount) === 0 ? '' : String(Number(lease.deposit_amount)),
    units: lease.units.map((unit) => {
      const rent = lease.rents.find((row) => row.unit_id === unit.unit_id);
      return {
        unitId: unit.unit_id,
        rent: rent ? String(Number(rent.rent_amount)) : '',
        charges: rent && Number(rent.charges_amount) !== 0 ? String(Number(rent.charges_amount)) : '',
      };
    }),
    renters: lease.parties.filter((party) => party.role === 'renter').map((party) => party.contact_id),
    guarantors: lease.parties.filter((party) => party.role === 'guarantor').map((party) => party.contact_id),
  };
}

export default function EditLeasePage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const result = useGraphql<{ lease: DraftLease | null }>(DRAFT_QUERY, { id });
  const back = (
    <Button asChild variant="ghost" size="sm" className="-ms-2">
      <Link href={'/baux/' + id}>
        <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
        {t.leases.edit.backToLease}
      </Link>
    </Button>
  );

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        {back}
        <Pulse className="text-sm text-muted-foreground">{t.leases.edit.loading}</Pulse>
      </div>
    );
  }
  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        {back}
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.leases.edit.loadError(result.message)}
        </p>
      </div>
    );
  }
  const lease = result.data.lease;
  if (!lease || lease.status !== 'draft') {
    return (
      <div className="space-y-6">
        {back}
        <p className="text-sm text-muted-foreground">{t.leases.edit.locked}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {back}
      <PageHeader title={t.leases.edit.title(formatLeaseNumber(lease.number))} description={t.leases.edit.description} />
      <LeaseForm initial={toInitial(lease)} />
    </div>
  );
}
