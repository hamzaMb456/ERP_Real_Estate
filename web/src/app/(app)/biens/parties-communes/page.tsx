'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SHARE_TOTAL, sharesTotal } from '@/lib/shares';
import { useGraphql } from '@/lib/use-graphql';

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
  const result = useGraphql<{ properties: Row[] }>(QUERY);

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader title="Parties communes" description="Parties communes et tantièmes de chaque immeuble." />
      </StaggerItem>
      {result.status === 'loading' && <SkeletonList count={3} className="space-y-3" itemClassName="h-14 rounded-lg bg-muted" label="Chargement…" />}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Impossible de charger les immeubles : {result.message}
        </p>
      )}
      {result.status === 'success' && (
        <StaggerItem>
          <Card className="gap-0 overflow-hidden py-0">
            {result.data.properties.length === 0 ? (
              <CardContent className="py-12 text-center text-sm text-muted-foreground">Aucun immeuble pour le moment.</CardContent>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-4">Immeuble</TableHead>
                    <TableHead className="hidden sm:table-cell">Ville</TableHead>
                    <TableHead>Parties communes</TableHead>
                    <TableHead>Tantièmes</TableHead>
                    <TableHead className="pr-4 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.data.properties.map((property) => {
                    const total = sharesTotal(property.units.map((unit) => unit.common_share));
                    const complete = property.units.length < 2 || total === SHARE_TOTAL;
                    return (
                      <TableRow key={property.id}>
                        <TableCell className="pl-4 font-medium">{property.name}</TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{property.city ?? '—'}</TableCell>
                        <TableCell className="tabular-nums">{property.common_areas_aggregate.aggregate?.count ?? 0}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={complete ? 'bg-success/12 text-success' : 'bg-warning/15 text-warning'}>
                            {complete ? 'Complets' : `${total} / ${SHARE_TOTAL}`}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <Button asChild variant="ghost" size="sm">
                            <Link href={'/biens/' + property.id + '#parties-communes'}>
                              Ouvrir
                              <ChevronRight data-icon="inline-end" />
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
