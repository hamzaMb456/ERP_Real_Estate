'use client';

import type { ReactNode } from 'react';
import {
  Banknote,
  CalendarClock,
  ChartColumn,
  ChartPie,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CreditCard,
  DoorOpen,
  FileCheck,
  FileText,
  Filter,
  Plus,
  Receipt,
  TriangleAlert,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useGraphql } from '@/lib/use-graphql';

const DASHBOARD_QUERY = `
  query Dashboard {
    units(where: { archived_at: { _is_null: true } }) {
      status
      property { branch { id name } }
    }
  }
`;

type DashboardUnit = { status: string; property: { branch: { id: string; name: string } | null } | null };

const PENDING = 'Disponible avec le module';

function ActionButton({ icon: Icon, label, primary }: { icon: LucideIcon; label: string; primary?: boolean }) {
  return (
    <button
      type="button"
      disabled
      title="Bientôt disponible"
      className={
        'flex h-10 items-center gap-2 rounded-lg px-4 text-xs shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ' +
        (primary
          ? 'bg-emerald-700 font-semibold text-white'
          : 'border border-slate-200 bg-white font-medium text-slate-700')
      }
    >
      <Icon className={'h-[18px] w-[18px] ' + (primary ? '' : 'text-slate-500')} aria-hidden />
      <span>{label}</span>
    </button>
  );
}

function KpiCard({
  label,
  icon: Icon,
  value,
  unit,
  note,
  tone = 'default',
  progress,
}: {
  label: string;
  icon: LucideIcon;
  value: string;
  unit?: string;
  note: ReactNode;
  tone?: 'default' | 'success' | 'danger';
  progress?: number;
}) {
  const border = tone === 'danger' ? 'border-red-200 bg-red-50/20' : 'border-slate-200';
  const labelColor = tone === 'danger' ? 'text-red-700' : tone === 'success' ? 'text-emerald-800' : 'text-slate-500';
  const iconColor = tone === 'danger' ? 'text-red-600' : tone === 'success' ? 'text-emerald-700' : 'text-slate-400';
  const valueColor = tone === 'danger' ? 'text-red-700' : tone === 'success' ? 'text-emerald-900' : 'text-slate-900';
  return (
    <div className={'relative flex flex-col justify-between overflow-hidden rounded-xl border bg-white p-4 shadow-sm ' + border}>
      {tone === 'success' && <div className="absolute left-0 right-0 top-0 h-1 bg-emerald-600" />}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className={'text-xs font-semibold uppercase tracking-wider ' + labelColor}>{label}</span>
          <Icon className={'h-[18px] w-[18px] ' + iconColor} aria-hidden />
        </div>
        <div className={'flex items-baseline gap-1 text-2xl font-bold tracking-tight tabular-nums ' + valueColor}>
          {value}
          {unit && <span className="text-xs font-medium text-slate-500">{unit}</span>}
        </div>
        {progress !== undefined && (
          <div className="mt-1.5">
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>Part du parc</span>
              <span className="font-semibold text-slate-700">{progress} %</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: progress + '%' }} />
            </div>
          </div>
        )}
        <p className="mt-1 text-[11px] text-slate-500">{note}</p>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  aside,
  children,
}: {
  title: string;
  icon: LucideIcon;
  aside?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-emerald-700" aria-hidden />
            <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          </div>
          {aside && <span className="text-xs text-slate-500">{aside}</span>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-xs text-slate-400">{children}</p>;
}

export default function DashboardPage() {
  const result = useGraphql<{ units: DashboardUnit[] }>(DASHBOARD_QUERY);
  const units = result.status === 'success' ? result.data.units : [];
  const total = units.length;
  const count = (status: string) => units.filter((unit) => unit.status === status).length;
  const rented = count('rented');
  const vacant = count('vacant');
  const maintenance = count('under_maintenance');
  const forSale = count('for_sale');
  const occupancy = total === 0 ? 0 : Math.round((rented / total) * 1000) / 10;

  const byBranch = new Map<string, { name: string; total: number; rented: number }>();
  for (const unit of units) {
    const branch = unit.property?.branch;
    if (!branch) continue;
    const entry = byBranch.get(branch.id) ?? { name: branch.name, total: 0, rented: 0 };
    entry.total += 1;
    if (unit.status === 'rented') entry.rented += 1;
    byBranch.set(branch.id, entry);
  }
  const branches = [...byBranch.values()].sort((a, b) => b.rented / b.total - a.rented / a.total);

  const loading = result.status === 'loading';
  const value = (text: string) => (loading ? '…' : text);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Tableau de bord</h1>
        <p className="mt-0.5 text-xs text-slate-500">Vue d’ensemble de la société</p>
      </div>

      {result.status === 'error' && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-xs text-red-800">
          Impossible de charger les chiffres : {result.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton icon={CreditCard} label="Enregistrer un paiement" primary />
        <ActionButton icon={FileText} label="Générer les factures du mois" />
        <ActionButton icon={Wrench} label="Créer un ordre de travail" />
        <ActionButton icon={Plus} label="Ajouter un bien" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Taux d’occupation"
          icon={ChartPie}
          value={value(occupancy.toString().replace('.', ',') + ' %')}
          note={loading ? '' : rented + ' / ' + total + ' unités louées'}
        />
        <KpiCard label="Loyers facturés ce mois" icon={Receipt} value="—" unit="TND" note={PENDING + ' Finance'} />
        <KpiCard label="Loyers encaissés" icon={Banknote} value="—" unit="TND" note={PENDING + ' Finance'} tone="success" />
        <KpiCard label="Loyers impayés" icon={TriangleAlert} value="—" unit="TND" note={PENDING + ' Finance'} tone="danger" />
        <KpiCard
          label="Unités vacantes"
          icon={DoorOpen}
          value={value(String(vacant))}
          note={loading ? '' : 'dont ' + maintenance + ' en travaux'}
        />
        <KpiCard label="Baux à échéance (60 j)" icon={CalendarClock} value="—" note={PENDING + ' Baux'} />
        <KpiCard label="Chèques en attente" icon={FileCheck} value="—" note={PENDING + ' Finance'} />
        <KpiCard label="Revenus de la société" icon={Wallet} value="—" unit="TND" note={PENDING + ' Finance'} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <Wrench className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <span className="text-slate-600">Ordres de travail ouverts :</span>
          <strong className="text-slate-900">—</strong>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden />
          <span className="text-slate-600">Réservations de vente en cours :</span>
          <strong className="text-slate-900">{loading ? '…' : forSale + ' unités à vendre'}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-2">
            <ChartColumn className="mt-0.5 h-4 w-4 text-emerald-700" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Facturé vs encaissé (12 derniers mois)</h2>
              <p className="text-xs text-slate-500">
                Évolution comparée de la facturation et du recouvrement mensuel.
              </p>
            </div>
          </div>
          <Empty>Les courbes apparaîtront dès que le module Finance enregistrera des factures et des paiements.</Empty>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-start gap-2">
            <ChartColumn className="mt-0.5 h-4 w-4 text-emerald-700" aria-hidden />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Taux d’occupation par succursale</h2>
              <p className="text-xs text-slate-500">
                Performance commerciale des {branches.length} agences régionales
              </p>
            </div>
          </div>
          <div className="space-y-3.5">
            {branches.map((branch) => {
              const rate = Math.round((branch.rented / branch.total) * 100);
              return (
                <div key={branch.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800">{branch.name}</span>
                    <span className="font-semibold text-slate-900">
                      {rate} % <span className="font-normal text-slate-400">({branch.rented} / {branch.total})</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-700" style={{ width: rate + '%' }} />
                  </div>
                </div>
              );
            })}
            {!loading && branches.length === 0 && <Empty>Aucune unité rattachée à une succursale.</Empty>}
          </div>
          <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
            <span>
              Moyenne consolidée : <strong className="font-semibold text-emerald-800">{occupancy.toString().replace('.', ',')} %</strong>
            </span>
            <span className="text-[11px] text-slate-400">Seuil d’alerte : &lt; 85 %</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col justify-between gap-4 p-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
              <CircleAlert className="h-[22px] w-[22px]" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Loyers en retard et dossiers pré-contentieux</h2>
              <p className="text-xs text-slate-500">Aucun dossier pour le moment</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled className="flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3.5 text-xs font-semibold text-slate-400">
              Relance groupée
            </button>
            <button type="button" disabled title="Bientôt disponible" className="flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 opacity-60">
              Exporter vers Excel
            </button>
          </div>
        </div>
        <div className="border-t border-slate-100 px-5">
          <Empty>Les loyers impayés seront listés ici avec le module Finance.</Empty>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        <SectionCard title="À approuver" icon={CircleCheck}>
          <Empty>Aucune demande en attente.</Empty>
        </SectionCard>
        <SectionCard title="Pipeline des ventes" icon={Filter}>
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600">Unités à vendre</span>
              <span className="font-bold text-slate-800">{loading ? '…' : forSale}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: (total === 0 ? 0 : (forSale / total) * 100) + '%' }} />
            </div>
            <p className="pt-2 text-[11px] text-slate-400">Visites, offres et compromis : module Ventes à venir.</p>
          </div>
        </SectionCard>
        <SectionCard title="Baux à échéance" icon={CalendarClock}>
          <Empty>Les échéances de baux apparaîtront ici.</Empty>
        </SectionCard>
        <SectionCard title="Docs fournisseurs" icon={FileText}>
          <Empty>Aucun document à renouveler.</Empty>
        </SectionCard>
      </div>

      <p className="flex items-center gap-1 text-[11px] text-slate-400">
        <ChevronRight className="h-3 w-3" aria-hidden />
        Les cartes marquées « — » se rempliront au fur et à mesure du développement des modules.
      </p>
    </div>
  );
}
