'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from '@/components/icons';
import { LeaseForm } from '@/components/leases/lease-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useCanEdit } from '@/lib/use-can-edit';

import { useT } from '@/i18n/provider';
function NewLeaseForm() {
  const params = useSearchParams();
  return <LeaseForm presetUnitId={params.get('unite') ?? undefined} />;
}

export default function NewLeasePage() {
  const t = useT();
  const canEdit = useCanEdit();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href="/baux">
          <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
          {t.leases.new.backToList}
        </Link>
      </Button>
      <PageHeader title={t.leases.new.title} description={t.leases.new.description} />
      {canEdit ? (
        <Suspense fallback={null}>
          <NewLeaseForm />
        </Suspense>
      ) : (
        <p className="text-sm text-muted-foreground">{t.leases.new.noRights}</p>
      )}
    </div>
  );
}
