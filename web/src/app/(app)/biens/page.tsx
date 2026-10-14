'use client';

import { Fragment, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Layers,
  List,
  Map as MapIcon,
  MoreVertical,
  Plus,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { StatusPill } from '@/components/status-pill';
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

const OUTLINE_BUTTON =
  'h-10 px-3.5 rounded-lg border border-app-border bg-white text-xs font-semibold text-[#0F2A20] flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-60';
const SELECT =
  'h-10 appearance-none rounded-lg border border-app-border bg-app-bg pl-3 pr-8 text-xs text-[#0F2A20] outline-none focus:ring-2 focus:ring-brand';

function ToolbarButton({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <button type="button" disabled title="Bientôt disponible" className={OUTLINE_BUTTON}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{label}</span>
    </button>
  );
}

function SelectBox({
  value,
  onChange,
  children,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="relative">
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={SELECT}>
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#52645A]">
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </div>
    </div>
  );
}

export default function BiensPage() {
  const result = useGraphql<{ properties: Property[] }>(PROPERTIES_QUERY);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('all');
  const [type, setType] = useState('all');
  const [branch, setBranch] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string[]>([]);

  const properties = useMemo(() => (result.status === 'success' ? result.data.properties : []), [result]);

  const cities = [...new Set(properties.map((property) => property.city).filter((value): value is string => !!value))];
  const branches = [
    ...new Map(properties.flatMap((property) => (property.branch ? [[property.branch.id, property.branch.name]] : []))),
  ];

  const visibleUnits = (property: Property) =>
    property.units.filter((unit) => (showArchived || !unit.archived_at) && (status === 'all' || unit.status === status));

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
    .map((property) => ({ property, units: visibleUnits(property) }))
    .filter(({ units }) => status === 'all' || units.length > 0);

  const allUnits = properties.flatMap((property) => property.units.filter((unit) => showArchived || !unit.archived_at));
  const countStatus = (value: StatusFilter) =>
    value === 'all' ? allUnits.length : allUnits.filter((unit) => unit.status === value).length;
  const activeProperties = properties.filter((property) => showArchived || !property.archived_at);

  function reset() {
    setSearch('');
    setCity('all');
    setType('all');
    setBranch('all');
    setStatus('all');
    setShowArchived(false);
  }

  function toggleSelected(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  return (
    <div className="mx-auto max-w-[1360px] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F2A20]">Biens et unités</h1>
          <p className="mt-0.5 text-sm text-[#52645A]">
            {allUnits.length} unités dans {activeProperties.length} biens
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="mr-1 flex items-center rounded-lg border border-app-border bg-white p-1">
            <span className="flex items-center gap-1.5 rounded border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-brand">
              <List className="h-3.5 w-3.5" aria-hidden />
              Liste
            </span>
            <span
              className="flex cursor-not-allowed items-center gap-1.5 rounded px-3 py-1.5 text-xs text-[#52645A]"
              title="Bientôt disponible"
            >
              <MapIcon className="h-3.5 w-3.5" aria-hidden />
              Carte
            </span>
          </div>
          <ToolbarButton icon={Download} label="Exporter vers Excel" />
          <ToolbarButton icon={Upload} label="Importer depuis Excel" />
          <ToolbarButton icon={Layers} label="Ajouter plusieurs unités" />
          <button
            type="button"
            disabled
            title="Bientôt disponible"
            className="ml-2 flex h-10 items-center gap-1.5 rounded-lg bg-brand px-4 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            <span>Ajouter un bien</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2.5 overflow-x-auto pb-1 pt-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            aria-pressed={status === chip.value}
            onClick={() => setStatus(chip.value)}
            className={
              'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand ' +
              (status === chip.value
                ? 'bg-brand font-semibold text-white shadow-sm'
                : 'border border-app-border bg-white font-medium text-[#52645A] transition-colors hover:bg-[#ECFDF5] hover:text-[#0F2A20]')
            }
          >
            <span>
              {chip.label} ({countStatus(chip.value)})
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-app-border bg-white p-3.5 text-sm shadow-sm">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative min-w-[260px] flex-1">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher par nom, adresse ou référence"
              className="h-10 w-full rounded-lg border border-app-border bg-app-bg pl-3.5 pr-8 text-xs text-[#0F2A20] outline-none placeholder:text-[#52645A] focus:border-brand focus:ring-2 focus:ring-brand"
            />
          </div>
          <SelectBox label="Ville" value={city} onChange={setCity}>
            <option value="all">Ville : Toutes</option>
            {cities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </SelectBox>
          <SelectBox label="Type" value={type} onChange={setType}>
            <option value="all">Type : Tous</option>
            {Object.entries(PROPERTY_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectBox>
          <SelectBox label="Succursale" value={branch} onChange={setBranch}>
            <option value="all">Succursale : Toutes</option>
            {branches.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </SelectBox>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
              className="h-4 w-4 rounded border-app-border accent-brand"
            />
            <span className="text-xs text-[#52645A]">Afficher les biens archivés</span>
          </label>
          <button type="button" onClick={reset} className="text-xs font-semibold text-brand hover:underline focus:outline-none">
            Réinitialiser
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-2.5 text-xs text-[#0F2A20]">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-brand" />
            <span className="font-semibold">
              {selected.length} {selected.length > 1 ? 'biens sélectionnés' : 'bien sélectionné'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelected([])}
            title="Désélectionner"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#52645A] transition-colors hover:bg-white hover:text-[#0F2A20]"
          >
            ✕
          </button>
        </div>
      )}

      {result.status === 'loading' && <p className="text-sm text-[#52645A]">Chargement des biens…</p>}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Impossible de charger les biens : {result.message}
        </p>
      )}

      {result.status === 'success' && (
        <div className="overflow-x-auto rounded-lg border border-app-border bg-white shadow-sm">
          <table className="w-full min-w-[960px] table-fixed border-collapse text-left text-xs">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '8%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-app-border bg-app-bg text-[11px] font-semibold uppercase tracking-wider text-[#52645A]">
                <th className="px-3 py-3 text-center" scope="col" />
                <th className="px-3 py-3" scope="col">Bien / Unité</th>
                <th className="px-3 py-3" scope="col">Ville</th>
                <th className="px-3 py-3" scope="col">Unités</th>
                <th className="px-3 py-3" scope="col">Statut</th>
                <th className="px-3 py-3" scope="col">Propriétaire(s)</th>
                <th className="px-3 py-3 text-right" scope="col">Loyer mensuel</th>
                <th className="px-3 py-3 text-center" scope="col">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {rows.map(({ property, units }) => {
                const open = expanded[property.id] ?? true;
                const rented = units.filter((unit) => unit.status === 'rented');
                const occupancy = units.length === 0 ? null : Math.round((rented.length / units.length) * 100);
                const rentTotal = rented.reduce((sum, unit) => sum + Number(unit.rent_amount ?? 0), 0);
                return (
                  <Fragment key={property.id}>
                    <tr className="bg-[#F8FCF9] transition-colors hover:bg-[#F2FAF5]">
                      <td className="px-3 py-3.5 text-center align-middle">
                        <input
                          type="checkbox"
                          aria-label={'Sélectionner ' + property.name}
                          checked={selected.includes(property.id)}
                          onChange={() => toggleSelected(property.id)}
                          className="h-4 w-4 rounded border-app-border accent-brand"
                        />
                      </td>
                      <td className="px-3 py-3.5 align-middle">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-label={(open ? 'Replier ' : 'Déplier ') + property.name}
                            onClick={() => setExpanded((current) => ({ ...current, [property.id]: !open }))}
                            className="flex h-6 w-6 items-center justify-center rounded text-brand outline-none transition-colors hover:bg-[#EAFEF1] focus:ring-2 focus:ring-brand"
                          >
                            {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                          </button>
                          <div className="truncate">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold text-[#0F2A20]">{property.name}</span>
                              {property.archived_at && (
                                <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                                  Archivé
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-[#52645A]">
                              {[property.address_line, PROPERTY_TYPES[property.type] ?? property.type, property.branch ? 'Succursale ' + property.branch.name : null]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="truncate px-3 py-3.5 align-middle font-medium text-[#0F2A20]">{property.city ?? '—'}</td>
                      <td className="px-3 py-3.5 align-middle font-medium text-[#0F2A20]">{units.length}</td>
                      <td className="px-3 py-3.5 align-middle">
                        {occupancy === null ? (
                          <span className="text-[#52645A]">—</span>
                        ) : (
                          <StatusPill status="rented" label={occupancy + ' % Loué'} />
                        )}
                      </td>
                      <td className="truncate px-3 py-3.5 align-middle text-[#52645A]">—</td>
                      <td className="px-3 py-3.5 text-right align-middle font-semibold tabular-nums text-[#0F2A20]">
                        {formatTnd(rentTotal)}
                      </td>
                      <td className="px-3 py-3.5 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <span className="cursor-not-allowed px-1 py-1 text-xs font-semibold text-brand opacity-60" title="Bientôt disponible">
                            Voir
                          </span>
                          <span className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-md border border-[#A7F3D0] bg-[#ECFDF5] text-brand opacity-60">
                            <MoreVertical className="h-3.5 w-3.5" aria-hidden />
                          </span>
                        </div>
                      </td>
                    </tr>
                    {open &&
                      units.map((unit) => (
                        <tr key={unit.id} className="bg-white transition-colors hover:bg-[#F9FCFA]">
                          <td className="px-3 py-3 text-center" />
                          <td className="px-3 py-3 align-middle">
                            <div className="pl-10">
                              <div className="font-semibold text-[#0F2A20]">{UNIT_TYPES[unit.type] ?? unit.type} {unit.code}</div>
                              <div className="mt-0.5 text-[11px] text-[#52645A]">
                                {[unit.floor === null ? null : 'Étage ' + unit.floor, unit.rooms === null ? null : unit.rooms + ' pièces', unit.surface_m2 === null ? null : formatArea(unit.surface_m2)]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3" />
                          <td className="px-3 py-3" />
                          <td className="px-3 py-3 align-middle">
                            <StatusPill status={unit.status} />
                          </td>
                          <td className="px-3 py-3 align-middle text-[#52645A]">—</td>
                          <td className="px-3 py-3 text-right align-middle font-semibold tabular-nums text-[#0F2A20]">
                            {formatTnd(unit.rent_amount)}
                          </td>
                          <td className="px-3 py-3 text-center align-middle">
                            <span className="cursor-not-allowed px-1 py-1 text-xs font-semibold text-brand opacity-60" title="Bientôt disponible">
                              Voir
                            </span>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-[#52645A]">
                    Aucun bien ne correspond à vos filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
