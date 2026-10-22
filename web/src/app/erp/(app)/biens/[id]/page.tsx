'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowLeft, Loader2, Pencil, Plus, SearchX } from '@/components/icons';
import { toast } from 'sonner';
import { CommonAreasTab } from '@/components/common-areas/common-areas-tab';
import { UnitDialog } from '@/components/domain/unit-dialog';
import { DocumentList } from '@/components/files/document-list';
import { PhotoGallery } from '@/components/files/photo-gallery';
import { Pulse, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { PropertyOverview } from '@/components/property/property-overview';
import { PropertyUnitsTable } from '@/components/property/property-units-table';
import type { PropertyDetails } from '@/components/property/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toUserMessage } from '@/lib/errors';
import { graphql } from '@/lib/graphql';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { useHashTab } from '@/lib/use-hash';

import { useT } from '@/i18n/provider';
const PROPERTY_QUERY = `
  query Property($id: uuid!) {
    property: properties_by_pk(id: $id) {
      id name type address_line city governorate postal_code latitude longitude archived_at
      branch { id name }
      owners(order_by: { units_count: desc }) { units_count contact { id full_name is_organization } }
      units(order_by: { code: asc }) {
        id code type floor rooms surface_m2 rent_amount status archived_at common_share
        ownerships { id unit_id contact_id share_percent starts_on ends_on }
        current_owners { share_percent contact { id full_name } }
      }
    }
  }
`;

const SET_ARCHIVED = `
  mutation SetPropertyArchived($id: uuid!, $archived_at: timestamptz) {
    update_properties_by_pk(pk_columns: { id: $id }, _set: { archived_at: $archived_at }) { id }
  }
`;

const PROPERTY_TABS = ['apercu', 'unites', 'photos', 'documents', 'parties-communes'] as const;
type PropertyTab = (typeof PROPERTY_TABS)[number];

function BackLink() {
  const t = useT();
  return (
    <Button asChild variant="ghost" size="sm" className="-ms-2">
      <Link href="/erp/biens">
        <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
        {t.properties.backToList}
      </Link>
    </Button>
  );
}

export default function PropertyDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const canEdit = useCanEdit();
  const [tab, setTab] = useHashTab(PROPERTY_TABS, 'apercu');
  const [reload, setReload] = useState(0);
  const [archiving, setArchiving] = useState(false);
  const result = useGraphql<{ property: PropertyDetails | null }>(PROPERTY_QUERY, { id }, reload);
  const refresh = () => setReload((value) => value + 1);

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        <BackLink />
        <Pulse className="text-sm text-muted-foreground">{t.properties.detail.loading}</Pulse>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        <BackLink />
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.properties.detail.loadError(result.message)}
        </p>
      </div>
    );
  }

  const property = result.data.property;
  if (!property) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" animation="draw" />
            </span>
            <p className="font-medium">{t.properties.detail.notFoundTitle}</p>
            <p className="text-sm text-muted-foreground">{t.properties.detail.notFoundBody}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = property;
  const archived = current.archived_at !== null;
  const units = current.units.filter((unit) => !unit.archived_at);

  async function toggleArchive() {
    setArchiving(true);
    try {
      await graphql(SET_ARCHIVED, { id: current.id, archived_at: archived ? null : new Date().toISOString() });
      toast.success(archived ? t.properties.detail.restoredToast : t.properties.detail.archivedToast, { description: current.name });
      refresh();
    } catch (error) {
      toast.error(t.properties.detail.actionFailed, { description: toUserMessage(error) });
    } finally {
      setArchiving(false);
    }
  }

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <BackLink />
      </StaggerItem>

      <StaggerItem>
        <PageHeader
          title={current.name}
          description={
            (t.labels.propertyTypes[current.type] ?? current.type) +
            (current.branch ? t.properties.detail.branchSuffix(current.branch.name) : '') +
            (archived ? t.properties.detail.archivedSuffix : '')
          }
          actions={
            canEdit && (
              <>
                <Button asChild variant="outline">
                  <Link href={'/erp/biens/' + current.id + '/modifier'}>
                    <Pencil data-icon="inline-start" />
                    {t.common.edit}
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => void toggleArchive()} disabled={archiving}>
                  {archiving ? (
                    <Loader2 data-icon="inline-start" />
                  ) : archived ? (
                    <ArchiveRestore data-icon="inline-start" />
                  ) : (
                    <Archive data-icon="inline-start" />
                  )}
                  {archived ? t.properties.detail.restore : t.properties.detail.archive}
                </Button>
                {!archived && current.type === 'building' && (
                  <UnitDialog
                    propertyId={current.id}
                    trigger={
                      <Button>
                        <Plus data-icon="inline-start" />
                        {t.properties.detail.addUnit}
                      </Button>
                    }
                    onSaved={refresh}
                  />
                )}
              </>
            )
          }
        />
      </StaggerItem>

      <StaggerItem>
        <Tabs value={tab} onValueChange={(value) => setTab(value as PropertyTab)}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="apercu">{t.properties.detail.tabOverview}</TabsTrigger>
            <TabsTrigger value="unites">{t.properties.detail.tabUnits(units.length)}</TabsTrigger>
            <TabsTrigger value="photos">{t.properties.detail.tabPhotos}</TabsTrigger>
            <TabsTrigger value="documents">{t.properties.detail.tabDocuments}</TabsTrigger>
            {current.type === 'building' && <TabsTrigger value="parties-communes">{t.properties.detail.tabCommonAreas}</TabsTrigger>}
          </TabsList>

          <TabsContent value="apercu" className="pt-4">
            <PropertyOverview property={current} units={units} />
          </TabsContent>
          <TabsContent value="unites" className="pt-4">
            <PropertyUnitsTable propertyId={current.id} units={units} canEdit={canEdit && !archived} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="photos" className="pt-4">
            <PhotoGallery target={{ propertyId: current.id }} />
          </TabsContent>
          <TabsContent value="documents" className="pt-4">
            <DocumentList target={{ propertyId: current.id }} />
          </TabsContent>
          {current.type === 'building' && (
            <TabsContent value="parties-communes" className="pt-4">
              <CommonAreasTab propertyId={current.id} units={units} onUnitsChanged={refresh} />
            </TabsContent>
          )}
        </Tabs>
      </StaggerItem>
    </Stagger>
  );
}
