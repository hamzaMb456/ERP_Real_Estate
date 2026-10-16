'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PropertyForm, type PropertyFormValues } from '@/components/domain/property-form';
import { Pulse } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';
const PROPERTY_QUERY = `
  query PropertyForEdit($id: uuid!) {
    property: properties_by_pk(id: $id) {
      id name type branch_id address_line city governorate postal_code latitude longitude
    }
  }
`;

type PropertyRow = {
  id: string;
  name: string;
  type: PropertyFormValues['type'];
  branch_id: string;
  address_line: string | null;
  city: string | null;
  governorate: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
};

const toNumber = (value: number | string | null) => (value === null ? null : Number(value));

function toFormValues(row: PropertyRow): PropertyFormValues {
  return {
    name: row.name,
    type: row.type,
    branch_id: row.branch_id,
    address_line: row.address_line ?? '',
    city: row.city ?? '',
    governorate: row.governorate ?? '',
    postal_code: row.postal_code ?? '',
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
  };
}

export default function EditPropertyPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const result = useGraphql<{ property: PropertyRow | null }>(PROPERTY_QUERY, { id });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ms-2">
        <Link href={'/biens/' + id}>
          <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
          {t.properties.backToProperty}
        </Link>
      </Button>
      {result.status === 'loading' && <Pulse className="text-sm text-muted-foreground">{t.properties.edit.loading}</Pulse>}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.properties.detail.loadError(result.message)}
        </p>
      )}
      {result.status === 'success' && !result.data.property && (
        <p className="text-sm text-muted-foreground">{t.properties.edit.missing}</p>
      )}
      {result.status === 'success' && result.data.property && (
        <>
          <PageHeader title={t.properties.edit.title(result.data.property.name)} description={t.properties.edit.description} />
          <PropertyForm mode="edit" propertyId={id} initial={toFormValues(result.data.property)} />
        </>
      )}
    </div>
  );
}
