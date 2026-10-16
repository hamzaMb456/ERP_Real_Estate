'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, SearchX } from 'lucide-react';
import { LEASE_QUERY, type LeaseDetails } from '@/components/leases/lease-details';
import { LeaseActions } from '@/components/leases/lease-actions';
import { LeaseDocuments } from '@/components/leases/lease-documents';
import { LeaseOverviewTab } from '@/components/leases/lease-overview-tab';
import { LeaseFlagBadges, LeaseStatusBadge } from '@/components/leases/lease-status-badge';
import { RentsTab } from '@/components/leases/rents-tab';
import { Pulse, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatLeaseNumber } from '@/lib/leases';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';
import { useHashTab } from '@/lib/use-hash';

import { useT } from '@/i18n/provider';
const LEASE_TABS = ['apercu', 'loyers', 'documents'] as const;
type LeaseTabName = (typeof LEASE_TABS)[number];

function BackLink() {
  const t = useT();
  return (
    <Button asChild variant="ghost" size="sm" className="-ms-2">
      <Link href="/baux">
        <ArrowLeft data-icon="inline-start" className="rtl:-scale-x-100" />
        {t.leases.new.backToList}
      </Link>
    </Button>
  );
}

export default function LeaseDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const canEdit = useCanEdit();
  const [tab, setTab] = useHashTab(LEASE_TABS, 'apercu');
  const [reload, setReload] = useState(0);
  const result = useGraphql<{ lease: LeaseDetails | null }>(LEASE_QUERY, { id }, reload);
  const refresh = () => setReload((value) => value + 1);

  if (result.status === 'loading') {
    return (
      <div className="space-y-6">
        <BackLink />
        <Pulse className="text-sm text-muted-foreground">{t.leases.detail.loading}</Pulse>
      </div>
    );
  }
  if (result.status === 'error') {
    return (
      <div className="space-y-6">
        <BackLink />
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.leases.detail.loadError(result.message)}
        </p>
      </div>
    );
  }
  const lease = result.data.lease;
  if (!lease) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <SearchX className="size-5" />
            </span>
            <p className="font-medium">{t.leases.detail.notFoundTitle}</p>
            <p className="text-sm text-muted-foreground">{t.leases.detail.notFoundBody}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renters = lease.parties.filter((party) => party.role === 'renter').map((party) => party.contact.full_name);
  const flagRow = {
    status: lease.status,
    is_ending_soon: lease.overview?.is_ending_soon ?? false,
    in_grace: lease.overview?.in_grace ?? false,
    grace_days_left: lease.overview?.grace_days_left ?? null,
    registration_state: lease.overview?.registration_state ?? ('not_applicable' as const),
    registration_deadline: lease.overview?.registration_deadline ?? null,
    end_date: lease.end_date,
  };

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <BackLink />
      </StaggerItem>
      <StaggerItem>
        <PageHeader
          title={formatLeaseNumber(lease.number)}
          description={[lease.units.map(({ unit }) => unit.code).join(', '), renters.join(', ')].filter(Boolean).join(' · ') + (lease.archived_at ? t.leases.detail.archivedSuffix : '')}
          actions={
            <>
              <LeaseStatusBadge status={lease.status} />
              <LeaseFlagBadges row={flagRow} />
              <LeaseActions lease={lease} onChanged={refresh} />
            </>
          }
        />
      </StaggerItem>
      <StaggerItem>
        <Tabs value={tab} onValueChange={(value) => setTab(value as LeaseTabName)}>
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="apercu">{t.leases.detail.tabOverview}</TabsTrigger>
            <TabsTrigger value="loyers">{t.leases.detail.tabRents}</TabsTrigger>
            <TabsTrigger value="documents">{t.leases.detail.tabDocuments}</TabsTrigger>
          </TabsList>
          <TabsContent value="apercu" className="pt-4">
            <LeaseOverviewTab lease={lease} canEdit={canEdit} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="loyers" className="pt-4">
            <RentsTab lease={lease} canEdit={canEdit} onChanged={refresh} />
          </TabsContent>
          <TabsContent value="documents" className="pt-4">
            <LeaseDocuments leaseId={lease.id} />
          </TabsContent>
        </Tabs>
      </StaggerItem>
    </Stagger>
  );
}
