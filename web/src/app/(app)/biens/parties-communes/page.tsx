'use client';

import Link from 'next/link';
import { ChevronRight } from '@/components/icons';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SHARE_TOTAL, sharesTotal } from '@/lib/shares';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';
const QUERY = `
  query CommonAreasOverview {
    properties(where: { archived_at: { _is_null: true }, type: { _eq: "building" } }, order_by: { name: asc }) {
      id name city
      common_areas_aggregate { aggregate { count } }
      units(where: { archived_at: { _is_null: true } }) { common_share }
    }
  }
`;

type Row = {
  id: string;
  name: string;
  city: string | null;
  common_areas_aggregate: { aggregate: { count: number } | null };
  units: { common_share: number | null }[];
};

export default function CommonAreasOverviewPage() {
  const t = useT();
  const result = useGraphql<{ properties: Row[] }>(QUERY);

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader title={t.properties.commonAreasOverview.title} description={t.properties.commonAreasOverview.description} />
      </StaggerItem>
      {result.status === 'loading' && <SkeletonList count={3} className="space-y-3" itemClassName="h-14 rounded-lg bg-muted" label={t.properties.commonAreasOverview.loading} />}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.properties.commonAreasOverview.loadError(result.message)}
        </p>
      )}
      {result.status === 'success' && (
        <StaggerItem>
          <Card className="gap-0 overflow-hidden py-0">
            {result.data.properties.length === 0 ? (
              <CardContent className="py-12 text-center text-sm text-muted-foreground">{t.properties.commonAreasOverview.empty}</CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="ps-4">{t.properties.commonAreasOverview.colBuilding}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t.properties.commonAreasOverview.colCity}</TableHead>
                    <TableHead>{t.properties.commonAreasOverview.colAreas}</TableHead>
                    <TableHead>{t.properties.commonAreasOverview.colShares}</TableHead>
                    <TableHead className="pe-4 text-end">
                      <span className="sr-only">{t.properties.commonAreasOverview.actions}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.properties.map((property) => {
                    const total = sharesTotal(property.units.map((unit) => unit.common_share));
                    const complete = property.units.length < 2 || total === SHARE_TOTAL;
                    return (
                      <TableRow key={property.id}>
                        <TableCell className="ps-4 font-medium">{property.name}</TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{property.city ?? '—'}</TableCell>
                        <TableCell className="tabular-nums">{property.common_areas_aggregate.aggregate?.count ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={complete ? 'bg-success/12 text-success' : 'bg-warning/15 text-warning'}>
                            {complete ? t.properties.commonAreasOverview.complete : `${total} / ${SHARE_TOTAL}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="pe-4 text-end">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={'/biens/' + property.id + '#parties-communes'}>
                              {t.properties.commonAreasOverview.open}
                              <ChevronRight data-icon="inline-end" className="rtl:-scale-x-100" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </StaggerItem>
      )}
    </Stagger>
  );
}
