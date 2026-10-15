'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { LeaseForm } from '@/components/leases/lease-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useCanEdit } from '@/lib/use-can-edit';

function NewLeaseForm() {
  const params = useSearchParams();
  return <LeaseForm presetUnitId={params.get('unite') ?? undefined} />;
}

export default function NewLeasePage() {
  const canEdit = useCanEdit();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/baux">
          <ArrowLeft data-icon="inline-start" />
          Retour aux baux
        </Link>
      </Button>
      <PageHeader title="Nouveau bail" description="Le bail est enregistré en brouillon ; vous l’activerez une fois signé." />
      {canEdit ? (
        <Suspense fallback={null}>
          <NewLeaseForm />
        </Suspense>
      ) : (
        <p className="text-sm text-muted-foreground">Vous n’avez pas les droits pour créer un bail.</p>
      )}
    </div>
  );
}
