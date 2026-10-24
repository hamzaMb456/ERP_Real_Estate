'use client';

import { useMemo, useState } from 'react';
import { Plus, Search, SearchX } from '@/components/icons';
import { UnitDialog } from '@/components/domain/unit-dialog';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { UnitCard } from '@/components/units/unit-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { filterUnits, unitBlockers, type UnitCardData, type UnitFilters, type WebsiteFilter } from '@/lib/units';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';

// One row per unit with what its card shows: the cover photo (first row of the photos, cover first), the number of
// photos (for the website rule), the running lease and the current owners.
const UNITS_QUERY = `
  query UnitsOverview {
    units(order_by: [{ property: { name: asc } }, { code: asc }], limit: 500) {
      id code type floor rooms surface_m2 rent_amount sale_price status archived_at show_on_website title
      property { id name city archived_at }
      photos: files(where: { kind: { _eq: "photo" } }, order_by: [{ is_cover: desc }, { sort_order: asc }], limit: 1) { storage_file_id }
      photoCount: files_aggregate(where: { kind: { _eq: "photo" } }) { aggregate { count } }
      current_lease { renter_names end_date }
      current_owners { contact { id full_name } }
    }
    properties(order_by: { name: asc }, limit: 500) { id name type archived_at }
  }
`;

type PropertyRow = { id: string; name: string; type: string; archived_at: string | null };

const STATUSES = ['all', 'vacant', 'rented', 'for_sale', 'under_maintenance'] as const;
const INITIAL_FILTERS: UnitFilters = { search: '', status: 'all', propertyId: 'all', website: 'all', showArchived: false };

export default function UnitsPage() {
  const t = useT();
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const [filters, setFilters] = useState<UnitFilters>(INITIAL_FILTERS);
  const result = useGraphql<{ units: UnitCardData[]; properties: PropertyRow[] }>(UNITS_QUERY, undefined, reload);

  const units = useMemo(() => (result.status === 'success' ? result.data.units : []), [result]);
  const properties = useMemo(() => (result.status === 'success' ? result.data.properties : []), [result]);
  const buildings = properties.filter((property) => property.type === 'building' && property.archived_at === null);
  const shown = filterUnits(units, filters);
  const visible = filterUnits(units, { ...INITIAL_FILTERS });
  const online = visible.filter((unit) => unitBlockers(unit).length === 0).length;
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(INITIAL_FILTERS);
  const set = (patch: Partial<UnitFilters>) => setFilters((current) => ({ ...current, ...patch }));
  const countStatus = (status: string) => (status === 'all' ? visible.length : visible.filter((unit) => unit.status === status).length);
  const statusLabel = (status: string) => (status === 'all' ? t.units.statusAll : (t.labels.unitStatuses[status] ?? status));

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader
          title={t.units.title}
          description={result.status === 'success' ? t.units.summary(visible.length, online) : t.units.loadingDescription}
          actions={
            canEdit && (
              <UnitDialog
                propertyOptions={buildings}
                trigger={
                  <Button>
                    <Plus data-icon="inline-start" />
                    {t.units.add}
                  </Button>
                }
                onSaved={() => setReload((value) => value + 1)}
              />
            )
          }
        />
      </StaggerItem>

      <StaggerItem>
        <Card className="py-4">
          <CardContent className="space-y-4">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={filters.status}
              onValueChange={(value) => set({ status: value || 'all' })}
              className="flex-wrap justify-start"
              aria-label={t.units.filterByStatus}
            >
              {STATUSES.map((status) => (
                <ToggleGroupItem key={status} value={status} className="gap-1.5">
                  {statusLabel(status)}
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{countStatus(status)}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex flex-wrap items-center gap-3">
              <InputGroup className="min-w-64 flex-1 sm:max-w-sm">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={filters.search}
                  onChange={(event) => set({ search: event.target.value })}
                  placeholder={t.units.searchPlaceholder}
                  aria-label={t.units.searchLabel}
                />
              </InputGroup>
              <Select value={filters.propertyId} onValueChange={(value) => set({ propertyId: value })}>
                <SelectTrigger className="w-52" aria-label={t.units.property}>
                  <SelectValue placeholder={t.units.property} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.units.allProperties}</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.website} onValueChange={(value) => set({ website: value as WebsiteFilter })}>
                <SelectTrigger className="w-40" aria-label={t.units.website}>
                  <SelectValue placeholder={t.units.website} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.units.websiteAll}</SelectItem>
                  <SelectItem value="online">{t.units.websiteOnline}</SelectItem>
                  <SelectItem value="offline">{t.units.websiteOffline}</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox id="units-archived" checked={filters.showArchived} onCheckedChange={(checked) => set({ showArchived: checked === true })} />
                <Label htmlFor="units-archived" className="text-sm font-normal text-muted-foreground">
                  {t.units.archived}
                </Label>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => setFilters(INITIAL_FILTERS)}>
                  {t.units.reset}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {result.status === 'loading' && (
        <SkeletonList count={6} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" itemClassName="h-72 rounded-xl bg-muted" label={t.units.loading} />
      )}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.units.loadError(result.message)}
        </p>
      )}

      {result.status === 'success' && shown.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" animation="draw" />
            </span>
            <p className="font-medium">{units.length === 0 ? t.units.emptyTitle : t.units.noMatchTitle}</p>
            <p className="text-sm text-muted-foreground">{units.length === 0 ? t.units.emptyBody : t.units.noMatchHint}</p>
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={() => setFilters(INITIAL_FILTERS)} className="mt-2">
                {t.units.reset}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {result.status === 'success' && shown.length > 0 && (
        <StaggerItem>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((unit) => (
              <UnitCard key={unit.id} unit={unit} />
            ))}
          </div>
        </StaggerItem>
      )}
    </Stagger>
  );
}
