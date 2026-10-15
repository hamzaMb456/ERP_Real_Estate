'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, ArrowLeft, Banknote, DoorOpen, Layers, Loader2, Maximize2, Pencil, SearchX } from 'lucide-react';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/domain/badges';
import { UNIT_STATUSES, UNIT_TYPES } from '@/components/domain/labels';
import { UnitDialog, type UnitFormUnit } from '@/components/domain/unit-dialog';
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
import { toFrenchError } from '@/lib/errors';
import { formatArea, formatTnd } from '@/lib/format';
import { graphql } from '@/lib/graphql';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { useHash, useHashTab } from '@/lib/use-hash';

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
  const { id, unitId } = useParams<{ id: string; unitId: string }>();
  const canEdit = useCanEdit();
  const [hash, setHash] = useHash();
  const [tab, setTab] = useHashTab(UNIT_TABS, 'apercu');
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const result = useGraphql<{ unit: UnitDetails | null }>(UNIT_QUERY, { id: unitId }, reload);

  const back = (
    <Button asChild variant="ghost" size="sm" className="-ml-2">
      <Link href={'/biens/' + id}>
        <ArrowLeft data-icon="inline-start" />
        Retour au bien
      </Link>
    </Button>
  );

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        {back}
        <Pulse className="text-sm text-muted-foreground">Chargement de l’unité…</Pulse>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        {back}
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger cette unité : {result.message}
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
              <SearchX className="size-5" />
            </span>
            <p className="font-medium">Unité introuvable</p>
            <p className="text-sm text-muted-foreground">Cette fiche n’existe pas ou vous n’y avez pas accès.</p>
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
      toast.error('Modification impossible', { description: toFrenchError(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={'/biens/' + current.property.id}>
            <ArrowLeft data-icon="inline-start" />
            Retour à {current.property.name}
          </Link>
        </Button>
      </StaggerItem>

      <StaggerItem>
        <PageHeader
          title={'Unité ' + current.code}
          description={(UNIT_TYPES[current.type] ?? current.type) + ' · ' + current.property.name + (archived ? ' · Archivée' : '')}
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
                        Modifier
                      </Button>
                    }
                    onSaved={() => setReload((value) => value + 1)}
                  />
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      void update({ archived_at: archived ? null : new Date().toISOString() }, archived ? 'Unité restaurée' : 'Unité archivée')
                    }
                  >
                    {saving ? (
                      <Loader2 data-icon="inline-start" className="animate-spin" />
                    ) : archived ? (
                      <ArchiveRestore data-icon="inline-start" />
                    ) : (
                      <Archive data-icon="inline-start" />
                    )}
                    {archived ? 'Restaurer' : 'Archiver'}
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
            <TabsTrigger value="apercu">Aperçu</TabsTrigger>
            <TabsTrigger value="proprietaires">Propriétaires</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="apercu" className="space-y-6 pt-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact icon={Banknote} label="Loyer mensuel" value={formatTnd(current.rent_amount)} />
              <Fact icon={Maximize2} label="Surface" value={formatArea(current.surface_m2)} />
              <Fact icon={DoorOpen} label="Pièces" value={current.rooms === null ? '—' : String(current.rooms)} />
              <Fact icon={Layers} label="Étage" value={current.floor === null ? '—' : String(current.floor)} />
            </div>
            <UnitLeaseCard unitId={current.id} canCreate={canEdit && !archived} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Statut de l’unité</CardTitle>
                <CardDescription>
                  Le statut suit les baux : loué dès qu’un bail est actif, disponible sinon. Les ventes viendront avec le module Ventes. Vous pouvez le corriger ici en cas d’exception.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={current.status} disabled={saving || archived || !canEdit} onValueChange={(value) => void update({ status: value }, 'Statut mis à jour')}>
                  <SelectTrigger className="w-full sm:w-64" aria-label="Statut de l’unité">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(UNIT_STATUSES).map(([value, label]) => (
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
