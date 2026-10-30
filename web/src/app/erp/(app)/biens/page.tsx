'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, ArchiveRestore, Building2, ChevronDown, Map as MapIcon, MapPin, MoreHorizontalIcon, Pencil, Plus, Search, SearchX, Trash2 } from '@/components/icons';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/domain/badges';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { StorageImage } from '@/components/files/storage-image';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { FieldHelp } from '@/components/field-help';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toUserMessage } from '@/lib/errors';
import { formatArea, formatTnd } from '@/lib/format';
import { graphql } from '@/lib/graphql';
import { useCanEdit, useCanManage } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

import { getIntlLocale } from '@/i18n/store';
import { useT } from '@/i18n/provider';
const PROPERTIES_QUERY = `
  query PropertiesWithUnits {
    properties(order_by: { name: asc }, limit: 200) {
      id
      name
      type
      address_line
      city
      archived_at
      branch { id name }
      files(where: { is_cover: { _eq: true } }, limit: 1) { storage_file_id }
      units(order_by: { code: asc }) {
        id
        code
        type
        floor
        rooms
        surface_m2
        rent_amount
        status
        archived_at
        current_owners { contact { id full_name } }
      }
    }
  }
`;

type Unit = {
  id: string;
  code: string;
  type: string;
  floor: number | null;
  rooms: number | null;
  surface_m2: number | string | null;
  rent_amount: number | string | null;
  status: string;
  archived_at: string | null;
  current_owners: { contact: { id: string; full_name: string } }[];
};

type Property = {
  id: string;
  name: string;
  type: string;
  address_line: string | null;
  city: string | null;
  archived_at: string | null;
  branch: { id: string; name: string } | null;
  files: { storage_file_id: string }[];
  units: Unit[];
};

const SET_PROPERTY_ARCHIVED = `
  mutation SetPropertyArchived($id: uuid!, $archived_at: timestamptz) {
    update_properties_by_pk(pk_columns: { id: $id }, _set: { archived_at: $archived_at }) { id }
  }
`;

const UPDATE_UNIT = `
  mutation UpdateUnit($id: uuid!, $set: units_set_input!) {
    update_units_by_pk(pk_columns: { id: $id }, _set: $set) { id }
  }
`;

const DELETE_UNIT = `
  mutation DeleteUnit($id: uuid!) {
    delete_units_by_pk(pk_columns: { id: $id }) { id }
  }
`;

type StatusFilter = 'all' | 'rented' | 'vacant' | 'for_sale' | 'under_maintenance';


export default function BiensPage() {
  const t = useT();
  const [reload, setReload] = useState(0);
  const chips: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t.properties.list.statusAll },
    { value: 'rented', label: t.properties.list.statusRented },
    { value: 'vacant', label: t.properties.list.statusVacant },
    { value: 'for_sale', label: t.properties.list.statusForSale },
    { value: 'under_maintenance', label: t.properties.list.statusUnderMaintenance },
  ];
  const result = useGraphql<{ properties: Property[] }>(PROPERTIES_QUERY, undefined, reload);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('all');
  const [type, setType] = useState('all');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [owner, setOwner] = useState('all');
  const canEdit = useCanEdit();
  const canManage = useCanManage();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Unit | null>(null);

  const properties = useMemo(() => (result.status === 'success' ? result.data.properties : []), [result]);
  const refetch = () => setReload((value) => value + 1);

  async function togglePropertyArchive(property: Property) {
    try {
      await graphql(SET_PROPERTY_ARCHIVED, { id: property.id, archived_at: property.archived_at ? null : new Date().toISOString() });
      toast.success(property.archived_at ? t.properties.detail.restoredToast : t.properties.detail.archivedToast, { description: property.name });
      refetch();
    } catch (error) {
      toast.error(t.properties.detail.actionFailed, { description: toUserMessage(error) });
    }
  }

  async function toggleUnitArchive(unit: Unit) {
    try {
      await graphql(UPDATE_UNIT, { id: unit.id, set: { archived_at: unit.archived_at ? null : new Date().toISOString() } });
      toast.success(unit.archived_at ? t.properties.unit.restoredToast : t.properties.unit.archivedToast, { description: unit.code });
      refetch();
    } catch (error) {
      toast.error(t.properties.unit.updateFailed, { description: toUserMessage(error) });
    }
  }

  // Backend is authoritative: it refuses a unit a lease, an owner or a request still references.
  async function removeUnit(unit: Unit) {
    try {
      await graphql(DELETE_UNIT, { id: unit.id });
      toast.success(t.properties.unit.deletedToast, { description: unit.code });
      refetch();
    } catch (error) {
      toast.error(t.properties.unit.updateFailed, { description: toUserMessage(error) });
    }
  }

  const cities = [...new Set(properties.map((property) => property.city).filter((value): value is string => !!value))];
  const branches = [
    ...new Map(properties.flatMap((property) => (property.branch ? [[property.branch.id, property.branch.name] as const] : []))),
  ];

  const owners = [
    ...new Map(
      properties.flatMap((property) =>
        property.units.flatMap((unit) => unit.current_owners.map((item) => [item.contact.id, item.contact.full_name] as const)),
      ),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1], getIntlLocale()));

  const needle = search.trim().toLowerCase();
  const rows = properties
    .filter(
      (property) =>
        (showArchived || !property.archived_at) &&
        (city === 'all' || property.city === city) &&
        (type === 'all' || property.type === type) &&
        (branch === 'all' || property.branch?.id === branch) &&
        (needle === '' ||
          property.name.toLowerCase().includes(needle) ||
          (property.address_line ?? '').toLowerCase().includes(needle) ||
          property.units.some((unit) => unit.code.toLowerCase().includes(needle))),
    )
    .map((property) => ({
      property,
      units: property.units.filter(
        (unit) =>
          (showArchived || !unit.archived_at) &&
          (status === 'all' || unit.status === status) &&
          (owner === 'all' || unit.current_owners.some((item) => item.contact.id === owner)),
      ),
    }))
    .filter(({ units }) => (status === 'all' && owner === 'all') || units.length > 0);

  const allUnits = properties.flatMap((property) => property.units.filter((unit) => showArchived || !unit.archived_at));
  const countStatus = (value: StatusFilter) =>
    value === 'all' ? allUnits.length : allUnits.filter((unit) => unit.status === value).length;
  const activeProperties = properties.filter((property) => showArchived || !property.archived_at);
  const hasFilters =
    search !== '' || city !== 'all' || type !== 'all' || branch !== 'all' || status !== 'all' || owner !== 'all' || showArchived;

  function reset() {
    setSearch('');
    setCity('all');
    setType('all');
    setBranch('all');
    setStatus('all');
    setOwner('all');
    setShowArchived(false);
  }

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader
          title={t.properties.list.title}
          description={
            result.status === 'success'
              ? t.properties.list.summary(allUnits.length, activeProperties.length)
              : t.properties.list.loadingDescription
          }
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/erp/biens/carte">
                  <MapIcon data-icon="inline-start" />
                  {t.properties.list.map}
                </Link>
              </Button>
              {canEdit && (
                <Button asChild>
                  <Link href="/erp/biens/nouveau">
                    <Plus data-icon="inline-start" />
                    {t.properties.list.add}
                  </Link>
                </Button>
              )}
            </>
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
              value={status}
              onValueChange={(value) => setStatus((value || 'all') as StatusFilter)}
              className="flex-wrap justify-start"
              aria-label={t.properties.list.filterByStatus}
            >
              {chips.map((chip) => (
                <ToggleGroupItem key={chip.value} value={chip.value} className="gap-1.5">
                  {chip.label}
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{countStatus(chip.value)}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>

            <div className="flex flex-wrap items-center gap-3">
              <InputGroup className="min-w-64 flex-1 sm:max-w-sm">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t.properties.list.searchPlaceholder}
                  aria-label={t.properties.list.searchLabel}
                />
              </InputGroup>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="w-40" aria-label={t.properties.list.city}>
                  <SelectValue placeholder={t.properties.list.city} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.properties.list.allCities}</SelectItem>
                  {cities.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-40" aria-label={t.properties.list.typeLabel}>
                  <SelectValue placeholder={t.properties.list.typePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.properties.list.allTypes}</SelectItem>
                  {Object.entries(t.labels.propertyTypes).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="w-44" aria-label={t.properties.list.branch}>
                  <SelectValue placeholder={t.properties.list.branch} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.properties.list.allBranches}</SelectItem>
                  {branches.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger className="w-48" aria-label={t.properties.list.owner}>
                  <SelectValue placeholder={t.properties.list.owner} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.properties.list.allOwners}</SelectItem>
                  {owners.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox id="archived" checked={showArchived} onCheckedChange={(checked) => setShowArchived(checked === true)} />
                <Label htmlFor="archived" className="text-sm font-normal text-muted-foreground">
                  {t.properties.list.archived}
                </Label>
                <FieldHelp>{t.properties.list.archivedHelp}</FieldHelp>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  {t.properties.list.reset}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {result.status === 'loading' && (
        <SkeletonList count={3} className="space-y-4" itemClassName="h-40 rounded-xl bg-muted" label={t.properties.list.loading} />
      )}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.properties.list.loadError(result.message)}
        </p>
      )}

      {result.status === 'success' && rows.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" animation="draw" />
            </span>
            <p className="font-medium">{t.properties.list.noMatchTitle}</p>
            <p className="text-sm text-muted-foreground">{t.properties.list.noMatchHint}</p>
            <Button variant="outline" size="sm" onClick={reset} className="mt-2">
              {t.properties.list.resetFilters}
            </Button>
          </CardContent>
        </Card>
      )}

      {result.status === 'success' &&
        rows.map(({ property, units }) => {
          const open = !collapsed[property.id];
          const rented = units.filter((unit) => unit.status === 'rented');
          const occupancy = units.length === 0 ? null : Math.round((rented.length / units.length) * 100);
          const rentTotal = rented.reduce((sum, unit) => sum + Number(unit.rent_amount ?? 0), 0);
          return (
            <StaggerItem key={property.id}>
              <Collapsible open={open} onOpenChange={(next) => setCollapsed((current) => ({ ...current, [property.id]: !next }))}>
                <Card className="gap-0 overflow-hidden py-0">
                  <CardHeader className="border-b bg-muted/30 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {property.files[0] ? (
                          <StorageImage
                            fileId={property.files[0].storage_file_id}
                            width={96}
                            alt={t.properties.list.photoOf(property.name)}
                            className="size-10 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                            <Building2 className="size-5" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold">
                            <Link href={'/erp/biens/' + property.id} className="hover:text-primary hover:underline">
                              {property.name}
                            </Link>
                            {property.archived_at && (
                              <span className="ms-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{t.properties.list.archivedBadge}</span>
                            )}
                          </h2>
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" aria-hidden />
                              {[property.address_line, property.city].filter(Boolean).join(', ') || t.properties.list.noAddress}
                            </span>
                            <span aria-hidden>·</span>
                            <span>{t.labels.propertyTypes[property.type] ?? property.type}</span>
                            {property.branch && (
                              <>
                                <span aria-hidden>·</span>
                                <span>{t.properties.list.branchName(property.branch.name)}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden text-end sm:block">
                          <p className="text-sm font-semibold tabular-nums">{formatTnd(rentTotal)}</p>
                          <p className="text-xs text-muted-foreground">{t.properties.list.monthlyRent}</p>
                        </div>
                        {occupancy !== null && <StatusBadge status="rented" label={t.properties.list.rentedPercent(occupancy)} />}
                        {canEdit && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
                                <MoreHorizontalIcon />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={'/erp/biens/' + property.id + '/modifier'}>
                                  <Pencil />
                                  {t.common.edit}
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void togglePropertyArchive(property)}>
                                {property.archived_at ? <ArchiveRestore /> : <Archive />}
                                {property.archived_at ? t.properties.detail.restore : t.properties.detail.archive}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={open ? t.properties.list.collapse(property.name) : t.properties.list.expand(property.name)}>
                            <ChevronDown className={'transition-transform duration-200 ' + (open ? 'rotate-180' : '')} />
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="ps-4">{t.properties.list.colUnit}</TableHead>
                          <TableHead className="hidden lg:table-cell">{t.properties.list.colOwner}</TableHead>
                          <TableHead className="hidden md:table-cell">{t.properties.list.colFloor}</TableHead>
                          <TableHead className="hidden md:table-cell">{t.properties.list.colRooms}</TableHead>
                          <TableHead className="hidden sm:table-cell">{t.properties.list.colSurface}</TableHead>
                          <TableHead className="text-end">{t.properties.list.colRent}</TableHead>
                          <TableHead className="pe-4">{t.properties.list.colStatus}</TableHead>
                          {canEdit && <TableHead className="pe-4"><span className="sr-only">{t.common.actions}</span></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <tbody className="[&_tr:last-child]:border-0">
                        {units.map((unit) => (
                          <TableRow key={unit.id}>
                            <TableCell className="ps-4">
                              <Link href={'/erp/biens/' + property.id + '/unites/' + unit.id} className="font-medium hover:text-primary hover:underline">
                                {unit.code}
                              </Link>
                              <span className="ms-2 text-xs text-muted-foreground">{t.labels.unitTypes[unit.type] ?? unit.type}</span>
                            </TableCell>
                            <TableCell className="hidden text-sm lg:table-cell">
                              {unit.current_owners.length === 0 ? (
                                <span className="text-xs font-medium text-warning">{t.properties.list.noOwner}</span>
                              ) : (
                                unit.current_owners.map((item) => item.contact.full_name).join(', ')
                              )}
                            </TableCell>
                            <TableCell className="hidden tabular-nums md:table-cell">{unit.floor ?? '—'}</TableCell>
                            <TableCell className="hidden tabular-nums md:table-cell">{unit.rooms ?? '—'}</TableCell>
                            <TableCell className="hidden tabular-nums sm:table-cell">{formatArea(unit.surface_m2)}</TableCell>
                            <TableCell className="text-end font-medium tabular-nums">{formatTnd(unit.rent_amount)}</TableCell>
                            <TableCell className="pe-4">
                              <StatusBadge status={unit.status} />
                            </TableCell>
                            {canEdit && (
                              <TableCell className="pe-4 text-end">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon-sm" aria-label={t.common.actions}>
                                      <MoreHorizontalIcon />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link href={'/erp/biens/' + property.id + '/unites/' + unit.id + '#modifier'}>
                                        <Pencil />
                                        {t.common.edit}
                                      </Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => void toggleUnitArchive(unit)}>
                                      {unit.archived_at ? <ArchiveRestore /> : <Archive />}
                                      {unit.archived_at ? t.properties.detail.restore : t.properties.detail.archive}
                                    </DropdownMenuItem>
                                    {canManage && unit.status !== 'rented' && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(unit)}>
                                          <Trash2 />
                                          {t.common.delete}
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        {units.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={canEdit ? 8 : 7} className="py-8 text-center text-sm text-muted-foreground">
                              {t.properties.list.noUnits}
                            </TableCell>
                          </TableRow>
                        )}
                      </tbody>
                    </Table>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </StaggerItem>
          );
        })}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t.properties.unit.deleteTitle}
        description={t.properties.unit.deleteBody(deleting?.code ?? '')}
        onConfirm={async () => {
          if (deleting) await removeUnit(deleting);
        }}
      />
    </Stagger>
  );
}
