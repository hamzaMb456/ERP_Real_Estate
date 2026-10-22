'use client';

import Link from 'next/link';
import { Building2, CheckCircle2, DoorOpen, Users } from '@/components/icons';
import { SkeletonList, Stagger, StaggerItem } from '@/components/motion/primitives';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { gapLabel, gapLink, groupGaps, type GapEntity, type GapRow } from '@/lib/gaps';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';
const QUERY = `
  query RecordGaps {
    record_gaps(order_by: [{ entity_type: asc }, { entity_label: asc }]) {
      entity_type entity_id property_id entity_label property_label gap_code
    }
  }
`;

const SECTIONS: { entity: GapEntity; icon: typeof Building2 }[] = [
  { entity: 'property', icon: Building2 },
  { entity: 'unit', icon: DoorOpen },
  { entity: 'contact', icon: Users },
];

export default function IncompleteRecordsPage() {
  const t = useT();
  const result = useGraphql<{ record_gaps: GapRow[] }>(QUERY);

  return (
    <Stagger className="space-y-6">
      <StaggerItem>
        <PageHeader
          title={t.properties.gaps.title}
          description={t.properties.gaps.description}
        />
      </StaggerItem>

      {result.status === 'loading' && <SkeletonList count={3} className="space-y-3" itemClassName="h-24 rounded-xl bg-muted" label={t.properties.gaps.loading} />}
      {result.status === 'error' && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {t.properties.gaps.loadError(result.message)}
        </p>
      )}

      {result.status === 'success' && result.data.record_gaps.length === 0 && (
        <StaggerItem>
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
              <CheckCircle2 className="size-8 text-success" animation="draw" aria-hidden />
              <p className="font-medium">{t.properties.gaps.allCompleteTitle}</p>
              <p className="text-sm text-muted-foreground">{t.properties.gaps.allCompleteBody}</p>
            </CardContent>
          </Card>
        </StaggerItem>
      )}

      {result.status === 'success' &&
        result.data.record_gaps.length > 0 &&
        (() => {
          const groups = groupGaps(result.data.record_gaps);
          return SECTIONS.filter((section) => groups[section.entity].length > 0).map((section) => {
            const Icon = section.icon;
            return (
              <StaggerItem key={section.entity}>
                <Card className="gap-0 py-0">
                  <CardHeader className="border-b py-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Icon className="size-4 text-muted-foreground" aria-hidden />
                      {t.properties.gaps.sections[section.entity]}
                    </CardTitle>
                    <CardDescription>{t.properties.gaps.toComplete(groups[section.entity].length)}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y">
                      {groups[section.entity].map((group) => (
                        <li key={group.entityId} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{group.label}</p>
                            {group.context && <p className="text-xs text-muted-foreground">{group.context}</p>}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {group.gaps.map((gap) => (
                              <Button key={gap.gap_code} asChild variant="outline" size="sm" className="h-7">
                                <Link href={gapLink(gap)}>
                                  <Badge variant="secondary" className="me-1 bg-warning/15 text-warning">
                                    !
                                  </Badge>
                                  {gapLabel(gap.gap_code)} · {t.properties.gaps.complete}
                                </Link>
                              </Button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          });
        })()}
    </Stagger>
  );
}
