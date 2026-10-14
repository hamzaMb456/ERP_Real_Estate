'use client';

import { StatusPill } from '@/components/status-pill';
import { formatTnd } from '@/lib/format';
import { useGraphql } from '@/lib/use-graphql';

const PROPERTIES_QUERY = `
  query PropertiesWithUnits {
    properties(where: { archived_at: { _is_null: true } }, order_by: { name: asc }) {
      id
      name
      city
      governorate
      branch { name }
      units(where: { archived_at: { _is_null: true } }, order_by: { code: asc }) {
        id
        code
        type
        floor
        rooms
        surface_m2
        rent_amount
        status
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
};
type Property = {
  id: string;
  name: string;
  city: string | null;
  governorate: string | null;
  branch: { name: string } | null;
  units: Unit[];
};

const UNIT_TYPES: Record<string, string> = {
  apartment: 'Appartement',
  office: 'Bureau',
  shop: 'Commerce',
  parking: 'Parking',
};

export default function BiensPage() {
  const result = useGraphql<{ properties: Property[] }>(PROPERTIES_QUERY);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Biens et unités</h1>

      {result.status === 'loading' && <p className="text-sm text-muted">Chargement des biens…</p>}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Impossible de charger les biens : {result.message}
        </p>
      )}
      {result.status === 'success' && result.data.properties.length === 0 && (
        <p className="rounded-lg border border-line bg-white p-6 text-sm text-muted">Aucun bien pour le moment.</p>
      )}

      {result.status === 'success' &&
        result.data.properties.map((property) => (
          <section key={property.id} className="overflow-hidden rounded-lg border border-line bg-white">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold text-ink">{property.name}</h2>
              <p className="text-sm text-muted">
                {[property.city, property.governorate].filter(Boolean).join(', ')}
                {property.branch ? ' · ' + property.branch.name : ''}
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-page text-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Unité</th>
                    <th className="px-5 py-2.5 font-medium">Type</th>
                    <th className="px-5 py-2.5 font-medium">Étage</th>
                    <th className="px-5 py-2.5 font-medium">Pièces</th>
                    <th className="px-5 py-2.5 font-medium">Surface</th>
                    <th className="px-5 py-2.5 text-right font-medium">Loyer</th>
                    <th className="px-5 py-2.5 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {property.units.map((unit) => (
                    <tr key={unit.id} className="border-t border-line">
                      <td className="px-5 py-3 font-medium text-ink">{unit.code}</td>
                      <td className="px-5 py-3">{UNIT_TYPES[unit.type] ?? unit.type}</td>
                      <td className="px-5 py-3 tabular-nums">{unit.floor ?? '—'}</td>
                      <td className="px-5 py-3 tabular-nums">{unit.rooms ?? '—'}</td>
                      <td className="px-5 py-3 tabular-nums">
                        {unit.surface_m2 === null ? '—' : Number(unit.surface_m2) + ' m²'}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatTnd(unit.rent_amount)}</td>
                      <td className="px-5 py-3">
                        <StatusPill status={unit.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
    </div>
  );
}
