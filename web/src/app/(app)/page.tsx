'use client';

import { useGraphql } from '@/lib/use-graphql';

const DASHBOARD_QUERY = `
  query Dashboard {
    properties: properties_aggregate(where: { archived_at: { _is_null: true } }) { aggregate { count } }
    units: units_aggregate(where: { archived_at: { _is_null: true } }) { aggregate { count } }
    vacant: units_aggregate(where: { archived_at: { _is_null: true }, status: { _eq: "vacant" } }) { aggregate { count } }
    contacts: contacts_aggregate { aggregate { count } }
  }
`;

type Counter = { aggregate: { count: number } };
type DashboardData = { properties: Counter; units: Counter; vacant: Counter; contacts: Counter };

export default function DashboardPage() {
  const result = useGraphql<DashboardData>(DASHBOARD_QUERY);

  const cards =
    result.status === 'success'
      ? [
          { label: 'Biens', value: result.data.properties.aggregate.count },
          { label: 'Unités', value: result.data.units.aggregate.count },
          { label: 'Unités vacantes', value: result.data.vacant.aggregate.count },
          { label: 'Contacts', value: result.data.contacts.aggregate.count },
        ]
      : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">Tableau de bord</h1>

      {result.status === 'loading' && <p className="text-sm text-muted">Chargement des chiffres…</p>}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          Impossible de charger les données : {result.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-line bg-white p-5">
            <p className="text-sm text-muted">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
