'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PropertyForm } from '@/components/domain/property-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/biens">
          <ArrowLeft data-icon="inline-start" />
          Retour aux biens
        </Link>
      </Button>
      <PageHeader
        title="Ajouter un bien"
        description="Créez la fiche d’un immeuble, d’une maison ou d’un terrain. Les unités d’un immeuble s’ajoutent ensuite depuis sa fiche."
      />
      <PropertyForm mode="create" />
    </div>
  );
}
