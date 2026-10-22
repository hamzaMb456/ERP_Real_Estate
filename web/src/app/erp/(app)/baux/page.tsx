'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search } from '@/components/icons';
import { LeaseFlagBadges, LeaseStatusBadge } from '@/components/leases/lease-status-badge';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatTnd } from '@/lib/format';
import type { LeaseOverviewRow } from '@/lib/lease-types';
import {
  formatLeaseNumber,
  LEASE_TAB_VALUES,
  leasePeriod,
  matchesLeaseSearch,
  matchesLeaseTab,
  type LeaseTab,
} from '@/lib/leases';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { useHashTab } from '@/lib/use-hash';

import { useT } from '@/i18n/provider';
const LEASES_QUERY = `
  query Leases {
    lease_overview(where: { archived_at: { _is_null: true } }, order_by: [{ number: desc }], limit: 500) {
      id number status start_date end_date unit_count unit_codes renter_names total_rent total_charges
      is_ending_soon in_grace grace_days_left registration_state registration_deadline
    }
  }
`;

export default function LeasesPage() {
  const t = useT();
  const result = useGraphql<{ lease_overview: LeaseOverviewRow[] }>(LEASES_QUERY);
  const canEdit = useCanEdit();
  const [tab, setTab] = useHashTab(LEASE_TAB_VALUES, 'all');
  const [search, setSearch] = useState('');

  const leases = useMemo(() => (result.status === 'success' ? result.data.lease_overview : []), [result]);
  const count = (value: LeaseTab) => leases.filter((lease) => matchesLeaseTab(lease, value)).length;
  const rows = leases.filter((lease) => matchesLeaseTab(lease, tab) && matchesLeaseSearch(lease, search));

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader
          title={t.leases.list.title}
          description={result.status === 'success' ? t.leases.list.count(leases.length) : t.leases.list.loadingDescription}
          actions={
            canEdit && (
              <Button asChild>
                <Link href="/erp/baux/nouveau">
                  <Plus data-icon="inline-start" />
                  {t.leases.list.new}
                </Link>
              </Button>
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
              value={tab}
              onValueChange={(value) => setTab((value || 'all') as LeaseTab)}
              className="flex-wrap justify-start"
              aria-label={t.leases.list.filterLabel}
            >
              {LEASE_TAB_VALUES.map((value) => (
                <ToggleGroupItem key={value} value={value} className="gap-1.5">
                  {t.leases.tabs[value]}
                  <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">{count(value)}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <InputGroup className="max-w-sm">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.leases.list.searchPlaceholder}
                aria-label={t.leases.list.searchLabel}
              />
            </InputGroup>
          </CardContent>
        </Card>
      </StaggerItem>

      <StaggerItem>
        {result.status === 'loading' && (
          <SkeletonList count={5} className="space-y-2" itemClassName="h-14 rounded-lg bg-muted" label={t.leases.list.loading} />
        )}
        {result.status === 'error' && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {t.leases.list.loadError(result.message)}
          </p>
        )}
        {result.status === 'success' && rows.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileText className="size-5" />
              </span>
              <p className="font-medium">{leases.length === 0 ? t.leases.list.emptyTitle : t.leases.list.noMatchTitle}</p>
              <p className="text-sm text-muted-foreground">
                {leases.length === 0 ? t.leases.list.emptyBody : t.leases.list.noMatchBody}
              </p>
            </CardContent>
          </Card>
        )}
        {result.status === 'success' && rows.length > 0 && (
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.leases.list.colLease}</TableHead>
                  <TableHead>{t.leases.list.colRenters}</TableHead>
                  <TableHead>{t.leases.list.colUnits}</TableHead>
                  <TableHead>{t.leases.list.colPeriod}</TableHead>
                  <TableHead className="text-end">{t.leases.list.colRent}</TableHead>
                  <TableHead>{t.leases.list.colStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((lease) => (
                  <TableRow key={lease.id}>
                    <TableCell className="font-medium">
                      <Link href={'/erp/baux/' + lease.id} className="text-primary hover:underline">
                        {formatLeaseNumber(lease.number)}
                      </Link>
                    </TableCell>
                    <TableCell>{lease.renter_names ?? '—'}</TableCell>
                    <TableCell>{lease.unit_codes ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap">{leasePeriod(lease)}</TableCell>
                    <TableCell className="text-end tabular-nums">{formatTnd(Number(lease.total_rent) + Number(lease.total_charges))}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <LeaseStatusBadge status={lease.status} />
                        <LeaseFlagBadges row={lease} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </StaggerItem>
    </Stagger>
  );
}
