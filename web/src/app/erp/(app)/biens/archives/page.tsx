'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArchiveRestore, ArchiveX, ArrowLeft, Building2, Loader2 } from '@/components/icons';
import { toast } from 'sonner';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { graphql } from '@/lib/graphql';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';
import { getIntlLocale } from '@/i18n/store';
const ARCHIVED_QUERY = `
  query ArchivedProperties {
    properties(where: { archived_at: { _is_null: false } }, order_by: { archived_at: desc }) {
      id
      name
      type
      city
      archived_at
      units_aggregate { aggregate { count } }
    }
  }
`;

const RESTORE = `
  mutation RestoreProperty($id: uuid!) {
    update_properties_by_pk(pk_columns: { id: $id }, _set: { archived_at: null }) { id }
  }
`;

type ArchivedProperty = {
  id: string;
  name: string;
  type: string;
  city: string | null;
  archived_at: string;
  units_aggregate: { aggregate: { count: number } | null };
};

function longDate(iso: string): string {
  return new Intl.DateTimeFormat(getIntlLocale(), { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default function ArchivedPropertiesPage() {
  const t = useT();
  const [reload, setReload] = useState(0);
  const [restoring, setRestoring] = useState<string | null>(null);
  const result = useGraphql<{ properties: ArchivedProperty[] }>(ARCHIVED_QUERY, undefined, reload);

  async function restore(property: ArchivedProperty) {
    setRestoring(property.id);
    try {
      await graphql(RESTORE, { id: property.id });
      toast.success(t.properties.archives.restoredToast, { description: property.name });
      setReload((value) => value + 1);
    } catch (error) {
      toast.error(t.properties.archives.restoreFailed, { description: error instanceof Error ? error.message : t.common.unknownError });
    } finally {
      setRestoring(null);
    }
  }

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <Button asChild variant="ghost" size="sm" className="-ms-2">
          <Link href="/erp/biens">
            <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
            {t.properties.backToList}
          </Link>
        </Button>
      </StaggerItem>

      <StaggerItem>
        <PageHeader
          title={t.properties.archives.title}
          description={t.properties.archives.description}
        />
      </StaggerItem>

      {result.status === 'loading' && (
        <SkeletonList count={3} className="space-y-3" itemClassName="h-20 rounded-xl bg-muted" label={t.properties.archives.loading} />
      )}

      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.properties.archives.loadError(result.message)}
        </p>
      )}

      {result.status === 'success' && result.data.properties.length === 0 && (
        <StaggerItem>
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ArchiveX className="size-5" />
              </span>
              <p className="font-medium">{t.properties.archives.emptyTitle}</p>
              <p className="text-sm text-muted-foreground">{t.properties.archives.emptyBody}</p>
            </CardContent>
          </Card>
        </StaggerItem>
      )}

      {result.status === 'success' &&
        result.data.properties.map((property) => (
          <StaggerItem key={property.id}>
            <Card className="py-4">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Building2 className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <Link href={'/erp/biens/' + property.id} className="block truncate font-semibold hover:text-primary hover:underline">
                      {property.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {t.labels.propertyTypes[property.type] ?? property.type}
                      {property.city ? ' · ' + property.city : ''} · {t.properties.archives.unitCount(property.units_aggregate.aggregate?.count ?? 0)} ·{' '}
                      {t.properties.archives.archivedOn(longDate(property.archived_at))}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" disabled={restoring === property.id} onClick={() => void restore(property)}>
                  {restoring === property.id ? (
                    <Loader2 data-icon="inline-start" />
                  ) : (
                    <ArchiveRestore data-icon="inline-start" />
                  )}
                  {t.properties.archives.restore}
                </Button>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
    </Stagger>
  );
}
