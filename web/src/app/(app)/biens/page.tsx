'use client';

import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Building2, ChevronDown, MapPin, Plus, Search, SearchX } from 'lucide-react';
import { StatusBadge } from '@/components/domain/badges';
import { SkeletonList, Stagger, StaggerItem, staggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatArea, formatTnd } from '@/lib/format';
import { useGraphql } from '@/lib/use-graphql';

const PROPERTIES_QUERY = `
  query PropertiesWithUnits {
    properties(order_by: { name: asc }) {
      id
      name
      type
      address_line
      city
      archived_at
      branch { id name }
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
};

type Property = {
  id: string;
  name: string;
  type: string;
  address_line: string | null;
  city: string | null;
  archived_at: string | null;
  branch: { id: string; name: string } | null;
  units: Unit[];
};

const UNIT_TYPES: Record<string, string> = {
  apartment: 'Appartement',
  office: 'Bureau',
  shop: 'Commerce',
  parking: 'Parking',
};
const PROPERTY_TYPES: Record<string, string> = { building: 'Immeuble', house: 'Maison', plot: 'Terrain' };

type StatusFilter = 'all' | 'rented' | 'vacant' | 'for_sale' | 'under_maintenance';
const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'rented', label: 'Louées' },
  { value: 'vacant', label: 'Disponibles' },
  { value: 'for_sale', label: 'À vendre' },
  { value: 'under_maintenance', label: 'En travaux' },
];

const rowsContainer = { hidden: {}, visible: { transition: { staggerChildren: 0.04 } } };
const MotionRow = motion.create(TableRow);

export default function BiensPage() {
  const result = useGraphql<{ properties: Property[] }>(PROPERTIES_QUERY);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('all');
  const [type, setType] = useState('all');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const properties = useMemo(() => (result.status === 'success' ? result.data.properties : []), [result]);

  const cities = [...new Set(properties.map((property) => property.city).filter((value): value is string => !!value))];
  const branches = [
    ...new Map(properties.flatMap((property) => (property.branch ? [[property.branch.id, property.branch.name] as const] : []))),
  ];

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
      units: property.units.filter((unit) => (showArchived || !unit.archived_at) && (status === 'all' || unit.status === status)),
    }))
    .filter(({ units }) => status === 'all' || units.length > 0);

  const allUnits = properties.flatMap((property) => property.units.filter((unit) => showArchived || !unit.archived_at));
  const countStatus = (value: StatusFilter) =>
    value === 'all' ? allUnits.length : allUnits.filter((unit) => unit.status === value).length;
  const activeProperties = properties.filter((property) => showArchived || !property.archived_at);
  const hasFilters = search !== '' || city !== 'all' || type !== 'all' || branch !== 'all' || status !== 'all' || showArchived;

  function reset() {
    setSearch('');
    setCity('all');
    setType('all');
    setBranch('all');
    setStatus('all');
    setShowArchived(false);
  }

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader
          title="Biens et unités"
          description={
            result.status === 'success'
              ? allUnits.length + ' unités dans ' + activeProperties.length + ' biens'
              : 'Chargement du parc immobilier…'
          }
          actions={
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button disabled>
                    <Plus data-icon="inline-start" />
                    Ajouter un bien
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Bientôt disponible</TooltipContent>
            </Tooltip>
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
              aria-label="Filtrer par statut"
            >
              {STATUS_CHIPS.map((chip) => (
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
                  placeholder="Nom, adresse ou référence d’unité"
                  aria-label="Rechercher un bien"
                />
              </InputGroup>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="w-40" aria-label="Ville">
                  <SelectValue placeholder="Ville" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les villes</SelectItem>
                  {cities.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="w-40" aria-label="Type de bien">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  {Object.entries(PROPERTY_TYPES).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="w-44" aria-label="Succursale">
                  <SelectValue placeholder="Succursale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les succursales</SelectItem>
                  {branches.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Checkbox id="archived" checked={showArchived} onCheckedChange={(checked) => setShowArchived(checked === true)} />
                <Label htmlFor="archived" className="text-sm font-normal text-muted-foreground">
                  Biens archivés
                </Label>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={reset}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </StaggerItem>

      {result.status === 'loading' && (
        <SkeletonList count={3} className="space-y-4" itemClassName="h-40 rounded-xl bg-muted" label="Chargement des biens…" />
      )}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les biens : {result.message}
        </p>
      )}

      {result.status === 'success' && rows.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" />
            </span>
            <p className="font-medium">Aucun bien ne correspond</p>
            <p className="text-sm text-muted-foreground">Modifiez les filtres pour élargir la recherche.</p>
            <Button variant="outline" size="sm" onClick={reset} className="mt-2">
              Réinitialiser les filtres
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
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                          <Building2 className="size-5" />
                        </span>
                        <div className="min-w-0">
                          <h2 className="truncate text-base font-semibold">
                            {property.name}
                            {property.archived_at && (
                              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Archivé</span>
                            )}
                          </h2>
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" aria-hidden />
                              {[property.address_line, property.city].filter(Boolean).join(', ') || 'Adresse non renseignée'}
                            </span>
                            <span aria-hidden>·</span>
                            <span>{PROPERTY_TYPES[property.type] ?? property.type}</span>
                            {property.branch && (
                              <>
                                <span aria-hidden>·</span>
                                <span>Succursale {property.branch.name}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden text-right sm:block">
                          <p className="text-sm font-semibold tabular-nums">{formatTnd(rentTotal)}</p>
                          <p className="text-xs text-muted-foreground">loyer mensuel</p>
                        </div>
                        {occupancy !== null && <StatusBadge status="rented" label={occupancy + ' % loué'} />}
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={(open ? 'Replier ' : 'Déplier ') + property.name}>
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
                          <TableHead className="pl-4">Unité</TableHead>
                          <TableHead className="hidden md:table-cell">Étage</TableHead>
                          <TableHead className="hidden md:table-cell">Pièces</TableHead>
                          <TableHead className="hidden sm:table-cell">Surface</TableHead>
                          <TableHead className="text-right">Loyer</TableHead>
                          <TableHead className="pr-4">Statut</TableHead>
                        </TableRow>
                      </TableHeader>
                      <motion.tbody variants={rowsContainer} initial="hidden" animate="visible" className="[&_tr:last-child]:border-0">
                        {units.map((unit) => (
                          <MotionRow key={unit.id} variants={staggerItem}>
                            <TableCell className="pl-4">
                              <span className="font-medium">{unit.code}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{UNIT_TYPES[unit.type] ?? unit.type}</span>
                            </TableCell>
                            <TableCell className="hidden tabular-nums md:table-cell">{unit.floor ?? '—'}</TableCell>
                            <TableCell className="hidden tabular-nums md:table-cell">{unit.rooms ?? '—'}</TableCell>
                            <TableCell className="hidden tabular-nums sm:table-cell">{formatArea(unit.surface_m2)}</TableCell>
                            <TableCell className="text-right font-medium tabular-nums">{formatTnd(unit.rent_amount)}</TableCell>
                            <TableCell className="pr-4">
                              <StatusBadge status={unit.status} />
                            </TableCell>
                          </MotionRow>
                        ))}
                        {units.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                              Aucune unité à afficher pour ce filtre.
                            </TableCell>
                          </TableRow>
                        )}
                      </motion.tbody>
                    </Table>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            </StaggerItem>
          );
        })}
    </Stagger>
  );
}
