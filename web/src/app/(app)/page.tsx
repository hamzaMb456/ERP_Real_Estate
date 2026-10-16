'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Cell, Pie, PieChart } from 'recharts';
import { ArrowUpRight, Building2, ClipboardList, DoorOpen, FileBadge, FileClock, KeyRound, Landmark, Plus, Users } from 'lucide-react';
import { StatusBadge } from '@/components/domain/badges';
import { AnimatedNumber, GrowBar, HoverLift, Reveal, SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { todayTunis } from '@/lib/dates';
import { formatTnd } from '@/lib/format';
import { useGraphql } from '@/lib/use-graphql';

import { formatNumber } from '@/lib/format';
import { useT } from '@/i18n/provider';
const DASHBOARD_QUERY = `
  query Dashboard($today: date!) {
    units(where: { archived_at: { _is_null: true } }) {
      status
      property { branch { id name } }
    }
    properties(where: { archived_at: { _is_null: true } }, order_by: { name: asc }, limit: 5) {
      id
      name
      city
      units(where: { archived_at: { _is_null: true } }) { status rent_amount }
    }
    contacts_aggregate { aggregate { count } }
    record_gaps_aggregate { aggregate { count } }
    leases_to_renew: lease_overview_aggregate(where: { _or: [{ is_ending_soon: { _eq: true } }, { in_grace: { _eq: true } }, { status: { _eq: "active" }, end_date: { _lt: $today } }] }) { aggregate { count } }
    registrations_due: lease_overview_aggregate(where: { registration_state: { _in: ["due_soon", "overdue"] } }) { aggregate { count } }
  }
`;

type DashboardData = {
  units: { status: string; property: { branch: { id: string; name: string } | null } | null }[];
  properties: { id: string; name: string; city: string | null; units: { status: string; rent_amount: number | string | null }[] }[];
  contacts_aggregate: { aggregate: { count: number } };
  record_gaps_aggregate: { aggregate: { count: number } };
  leases_to_renew: { aggregate: { count: number } };
  registrations_due: { aggregate: { count: number } };
};

const STATUS_COLORS = {
  rented: 'var(--chart-1)',
  vacant: 'var(--chart-3)',
  for_sale: 'var(--chart-2)',
  under_maintenance: 'var(--chart-4)',
  sold: 'var(--chart-5)',
};

const formatPercent = (n: number) => formatNumber(Math.round(n * 10) / 10, 1) + ' %';
const formatInt = (n: number) => String(Math.round(n));

function Kpi({
  label,
  icon: Icon,
  value,
  format,
  hint,
}: {
  label: string;
  icon: typeof Users;
  value: number;
  format: (n: number) => string;
  hint: string;
}) {
  return (
    <StaggerItem className="h-full">
      <HoverLift className="h-full">
        <Card className="h-full">
          <CardHeader>
            <CardDescription>{label}</CardDescription>
            <CardAction>
              <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
            </CardAction>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              <AnimatedNumber value={value} format={format} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{hint}</CardContent>
        </Card>
      </HoverLift>
    </StaggerItem>
  );
}

export default function DashboardPage() {
  const t = useT();
  const [today] = useState(todayTunis);
  const result = useGraphql<DashboardData>(DASHBOARD_QUERY, { today });

  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        <PageHeader title={t.nav.items.dashboard} />
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.dashboard.loadError(result.message)}
        </p>
      </div>
    );
  }

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        <PageHeader title={t.nav.items.dashboard} description={t.dashboard.overview} />
        <SkeletonList
          count={4}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          itemClassName="h-32 rounded-xl bg-muted"
          label={t.dashboard.loading}
        />
      </div>
    );
  }

  const { units, properties, contacts_aggregate, record_gaps_aggregate, leases_to_renew, registrations_due } = result.data;
  const total = units.length;
  const count = (status: string) => units.filter((unit) => unit.status === status).length;
  const rented = count('rented');
  const vacant = count('vacant');
  const occupancy = total === 0 ? 0 : (rented / total) * 100;

  const statusConfig: ChartConfig = Object.fromEntries(
    (Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[]).map((status) => [
      status,
      { label: t.labels.unitStatuses[status], color: STATUS_COLORS[status] },
    ]),
  );
  const chartData = (Object.keys(STATUS_COLORS) as (keyof typeof STATUS_COLORS)[])
    .map((status) => ({ status, label: t.labels.unitStatuses[status], value: count(status), fill: STATUS_COLORS[status] }))
    .filter((entry) => entry.value > 0);

  const byBranch = new Map<string, { name: string; total: number; rented: number }>();
  for (const unit of units) {
    const branch = unit.property?.branch;
    if (!branch) continue;
    const entry = byBranch.get(branch.id) ?? { name: branch.name, total: 0, rented: 0 };
    entry.total += 1;
    if (unit.status === 'rented') entry.rented += 1;
    byBranch.set(branch.id, entry);
  }
  const branches = [...byBranch.entries()]
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => b.rented / b.total - a.rented / a.total);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.nav.items.dashboard}
        description={t.dashboard.description}
        actions={
          <Button asChild>
            <Link href="/contacts/nouveau">
              <Plus data-icon="inline-start" />
              {t.shell.command.addContact}
            </Link>
          </Button>
        }
      />

      {record_gaps_aggregate.aggregate.count > 0 && (
        <Link
          href="/biens/fiches-incompletes"
          className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
        >
          <span className="flex items-center gap-2 font-medium">
            <ClipboardList className="size-4 text-warning" aria-hidden />
            {t.dashboard.gaps(record_gaps_aggregate.aggregate.count)}
          </span>
          <span className="text-muted-foreground">{t.dashboard.complete} {t.common.arrow}</span>
        </Link>
      )}

      {(leases_to_renew.aggregate.count > 0 || registrations_due.aggregate.count > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {leases_to_renew.aggregate.count > 0 && (
            <Link
              href="/baux#renew"
              className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
            >
              <span className="flex items-center gap-2 font-medium">
                <FileClock className="size-4 text-warning" aria-hidden />
                {t.dashboard.leasesToRenew(leases_to_renew.aggregate.count)}
              </span>
              <span className="text-muted-foreground">{t.dashboard.view} {t.common.arrow}</span>
            </Link>
          )}
          {registrations_due.aggregate.count > 0 && (
            <Link
              href="/baux#active"
              className="flex items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:bg-warning/15"
            >
              <span className="flex items-center gap-2 font-medium">
                <FileBadge className="size-4 text-warning" aria-hidden />
                {t.dashboard.registrationsDue(registrations_due.aggregate.count)}
              </span>
              <span className="text-muted-foreground">{t.dashboard.view} {t.common.arrow}</span>
            </Link>
          )}
        </div>
      )}

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t.dashboard.kpiOccupancy} icon={KeyRound} value={occupancy} format={formatPercent} hint={t.dashboard.kpiOccupancyHint(rented, total)} />
        <Kpi
          label={t.dashboard.kpiVacant}
          icon={DoorOpen}
          value={vacant}
          format={formatInt}
          hint={t.dashboard.kpiVacantHint(count('under_maintenance'), count('for_sale'))}
        />
        <Kpi label={t.dashboard.kpiProperties} icon={Building2} value={properties.length} format={formatInt} hint={t.dashboard.kpiBranches(byBranch.size)} />
        <Kpi
          label={t.dashboard.kpiContacts}
          icon={Users}
          value={contacts_aggregate.aggregate.count}
          format={formatInt}
          hint={t.dashboard.kpiContactsHint}
        />
      </Stagger>

      <div className="grid gap-4 lg:grid-cols-5">
        <Reveal className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t.dashboard.distributionTitle}</CardTitle>
              <CardDescription>{t.dashboard.distributionDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">{t.dashboard.distributionEmpty}</p>
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
                  <ChartContainer config={statusConfig} className="aspect-square h-44 shrink-0" aria-hidden>
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="status" hideLabel />} />
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="status"
                        innerRadius={48}
                        outerRadius={78}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {chartData.map((entry) => (
                          <Cell key={entry.status} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <ul className="w-full space-y-2 text-sm">
                    {chartData.map((entry) => (
                      <li key={entry.status} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.fill }} aria-hidden />
                          {entry.label}
                        </span>
                        <span className="font-medium tabular-nums">{entry.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal className="lg:col-span-3" delay={0.08}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t.dashboard.branchesTitle}</CardTitle>
              <CardDescription>{t.dashboard.branchesDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {branches.map((branch) => {
                const rate = Math.round((branch.rented / branch.total) * 100);
                return (
                  <div key={branch.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{branch.name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {branch.rented} / {branch.total} · <span className="font-medium text-foreground">{rate} %</span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <GrowBar percent={rate} className="bg-primary" />
                    </div>
                  </div>
                );
              })}
              {branches.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">{t.dashboard.branchesEmpty}</p>
              )}
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Reveal className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>{t.dashboard.propertiesTitle}</CardTitle>
              <CardDescription>{t.dashboard.propertiesDescription}</CardDescription>
              <CardAction>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/biens">
                    {t.dashboard.seeAll} <ArrowUpRight data-icon="inline-end" className="rtl:-scale-x-100" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="divide-y">
              {properties.map((property) => {
                const rentedUnits = property.units.filter((unit) => unit.status === 'rented');
                const rent = rentedUnits.reduce((sum, unit) => sum + Number(unit.rent_amount ?? 0), 0);
                const rate = property.units.length === 0 ? null : Math.round((rentedUnits.length / property.units.length) * 100);
                return (
                  <div key={property.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{property.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {property.city ?? '—'} · {t.dashboard.unitCount(property.units.length)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="hidden text-sm tabular-nums text-muted-foreground sm:inline">{formatTnd(rent)}</span>
                      <StatusBadge status="rented" label={rate === null ? '—' : t.properties.list.rentedPercent(rate)} />
                    </div>
                  </div>
                );
              })}
              {properties.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t.dashboard.propertiesEmpty}</p>}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal className="lg:col-span-2" delay={0.08}>
          <Card className="h-full border-dashed bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="size-4 text-muted-foreground" />
                {t.dashboard.financeTitle}
              </CardTitle>
              <CardDescription>
                {t.dashboard.financeDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• {t.dashboard.financeBullets}</li>
                <li>• {t.dashboard.financeBullets2}</li>
                <li>• {t.dashboard.financeBullets3}</li>
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
