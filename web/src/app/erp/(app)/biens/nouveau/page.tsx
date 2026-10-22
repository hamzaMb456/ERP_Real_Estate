'use client';

import Link from 'next/link';
import { ArrowLeft } from '@/components/icons';
import { PropertyForm } from '@/components/domain/property-form';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';

import { useT } from '@/i18n/provider';
export default function NewPropertyPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href="/erp/biens">
          <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
          {t.properties.backToList}
        </Link>
      </Button>
      <PageHeader
        title={t.properties.new.title}
        description={t.properties.new.description}
      />
      <PropertyForm mode="create" />
    </div>
  );
}
