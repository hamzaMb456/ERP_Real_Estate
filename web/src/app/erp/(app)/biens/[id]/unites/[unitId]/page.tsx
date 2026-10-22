'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowLeft, Banknote, DoorOpen, Layers, Loader2, Maximize2, Pencil, SearchX } from '@/components/icons';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/domain/badges';
import { UnitDialog, type UnitFormUnit } from '@/components/domain/unit-dialog';
import { FieldHelp } from '@/components/field-help';
import { DocumentList } from '@/components/files/document-list';
import { PhotoGallery } from '@/components/files/photo-gallery';
import { UnitLeaseCard } from '@/components/leases/unit-lease-card';
import { HoverLift, Pulse, Stagger, StaggerItem } from '@/components/motion/primitives';
import { UnitOwnersTab } from '@/components/ownership/unit-owners-tab';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toUserMessage } from '@/lib/errors';
import { formatArea, formatTnd } from '@/lib/format';
import { graphql } from '@/lib/graphql';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { useHash, useHashTab } from '@/lib/use-hash';

import { useT } from '@/i18n/provider';
const UNIT_QUERY = `
  query Unit($id: uuid!) {
    unit: units_by_pk(id: $id) {
      id code type floor rooms surface_m2 rent_amount status archived_at
      property { id name }
    }
  }
`;

const UPDATE_UNIT = `
  mutation UpdateUnit($id: uuid!, $set: units_set_input!) {
    update_units_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

const UNIT_TABS = ['apercu', 'proprietaires', 'photos', 'documents'] as const;

type UnitDetails = UnitFormUnit & { archived_at: string | null; property: { id: string; name: string } };

function Fact({ icon: Icon, label, value }: { icon: typeof Layers; label: string; value: string }) {
  return (
    <HoverLift className="h-full rounded-xl">
      <Card className="h-full py-4">
        <CardContent className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums">{value}</p>
          </div>
        </CardContent>
      </Card>
    </HoverLift>
  );
}

export default function UnitDetailPage() {
  const t = useT();
  const { id, unitId } = useParams<{ id: string; unitId: string }>();
  const canEdit = useCanEdit();
  const [hash, setHash] = useHash();
  const [tab, setTab] = useHashTab(UNIT_TABS, 'apercu');
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const result = useGraphql<{ unit: UnitDetails | null }>(UNIT_QUERY, { id: unitId }, reload);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ms-2">
      <Link href={'/erp/biens/' + id}>
        <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
        {t.properties.backToProperty}
      </Link>
    </Button>
  );

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        {back}
        <Pulse className="text-sm text-muted-foreground">{t.properties.unit.loading}</Pulse>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        {back}
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.properties.unit.loadError(result.message)}
        </p>
      </div>
    );
  }

  const unit = result.data.unit;
  if (!unit) {
    return (
      <div className="space-y-6">
        {back}
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" animation="draw" />
            </span>
            <p className="font-medium">{t.properties.unit.notFoundTitle}</p>
            <p className="text-sm text-muted-foreground">{t.properties.unit.notFoundBody}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = unit;
  const archived = current.archived_at !== null;

  async function update(set: Record<string, unknown>, success: string) {
    setSaving(true);
    try {
      await graphql(UPDATE_UNIT, { id: current.id, set });
      toast.success(success, { description: current.code });
      setReload((value) => value + 1);
    } catch (error) {
      toast.error(t.properties.unit.updateFailed, { description: toUserMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <Button asChild variant="ghost" size="sm" className="-ms-2">
          <Link href={'/erp/biens/' + current.property.id}>
            <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
            {t.properties.unit.backTo(current.property.name)}
          </Link>
        </Button>
      </StaggerItem>

      <StaggerItem>
        <PageHeader
          title={t.properties.unit.title(current.code)}
          description={(t.labels.unitTypes[current.type] ?? current.type) + ' · ' + current.property.name + (archived ? t.properties.unit.archivedSuffix : '')}
          actions={
            <>
              <StatusBadge status={current.status} />
              {canEdit && (
                <>
                  <UnitDialog
                    propertyId={current.property.id}
                    unit={current}
                    open={hash === 'modifier'}
                    onOpenChange={(open) => setHash(open ? 'modifier' : tab)}
                    trigger={
                      <Button variant="outline">
                        <Pencil data-icon="inline-start" />
                        {t.common.edit}
                      </Button>
                    }
                    onSaved={() => setReload((value) => value + 1)}
                  />
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      void update({ archived_at: archived ? null : new Date().toISOString() }, archived ? t.properties.unit.restoredToast : t.properties.unit.archivedToast)
                    }
                  >
                    {saving ? (
                      <Loader2 data-icon="inline-start" />
                    ) : archived ? (
                      <ArchiveRestore data-icon="inline-start" />
                    ) : (
                      <Archive data-icon="inline-start" />
                    )}
                    {archived ? t.properties.detail.restore : t.properties.detail.archive}
                  </Button>
                </>
              )}
            </>
          }
        />
      </StaggerItem>

      <StaggerItem>
        <Tabs value={tab} onValueChange={(value) => setTab(value as (typeof UNIT_TABS)[number])}>
          <TabsList>
            <TabsTrigger value="apercu">{t.properties.unit.tabOverview}</TabsTrigger>
            <TabsTrigger value="proprietaires">{t.properties.unit.tabOwners}</TabsTrigger>
            <TabsTrigger value="photos">{t.properties.unit.tabPhotos}</TabsTrigger>
            <TabsTrigger value="documents">{t.properties.unit.tabDocuments}</TabsTrigger>
          </TabsList>

          <TabsContent value="apercu" className="space-y-6 pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact icon={Banknote} label={t.properties.unit.factRent} value={formatTnd(current.rent_amount)} />
              <Fact icon={Maximize2} label={t.properties.unit.factSurface} value={formatArea(current.surface_m2)} />
              <Fact icon={DoorOpen} label={t.properties.unit.factRooms} value={current.rooms === null ? '—' : String(current.rooms)} />
              <Fact icon={Layers} label={t.properties.unit.factFloor} value={current.floor === null ? '—' : String(current.floor)} />
            </div>
            <UnitLeaseCard unitId={current.id} canCreate={canEdit && !archived} />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5 text-base">
                  {t.properties.unit.statusTitle}
                  <FieldHelp>
                    {t.properties.unit.statusHelp}
                  </FieldHelp>
                </CardTitle>
                <CardDescription>
                  {t.properties.unit.statusDescription}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={current.status} disabled={saving || archived || !canEdit} onValueChange={(value) => void update({ status: value }, t.properties.unit.statusUpdated)}>
                  <SelectTrigger className="w-full sm:w-64" aria-label={t.properties.unit.statusTitle}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(t.labels.unitStatuses).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="proprietaires" className="pt-4">
            <UnitOwnersTab unitId={current.id} />
          </TabsContent>
          <TabsContent value="photos" className="pt-4">
            <PhotoGallery target={{ unitId: current.id }} />
          </TabsContent>
          <TabsContent value="documents" className="pt-4">
            <DocumentList target={{ unitId: current.id }} />
          </TabsContent>
        </Tabs>
      </StaggerItem>
    </Stagger>
  );
}
