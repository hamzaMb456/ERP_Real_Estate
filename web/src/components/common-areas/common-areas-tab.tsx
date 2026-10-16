'use client';

import { useState } from 'react';
import { CommonAreasList, type CommonArea } from '@/components/common-areas/common-areas-list';
import { SharesTable, type ShareUnit } from '@/components/common-areas/shares-table';
import { Pulse } from '@/components/motion/primitives';
import { useCanEdit } from '@/lib/use-can-edit';
import { useGraphql } from '@/lib/use-graphql';

import { useT } from '@/i18n/provider';
const AREAS_QUERY = `
  query CommonAreas($propertyId: uuid!) {
    common_areas(where: { property_id: { _eq: $propertyId } }, order_by: { name: asc }) { id name kind notes }
  }
`;

export function CommonAreasTab({
  propertyId,
  units,
  onUnitsChanged,
}: {
  propertyId: string;
  units: ShareUnit[];
  onUnitsChanged: () => void;
}) {
  const t = useT();
  const canEdit = useCanEdit();
  const [reload, setReload] = useState(0);
  const areas = useGraphql<{ common_areas: CommonArea[] }>(AREAS_QUERY, { propertyId }, reload);
  // A new key resets the draft once saved values come back from the server.
  const sharesKey = units.map((unit) => unit.id + ':' + unit.common_share).join('|');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {areas.status === 'loading' && <Pulse className="text-sm text-muted-foreground">{t.files.areas.tabLoading}</Pulse>}
      {areas.status === 'error' && <p role="alert" className="text-sm text-destructive">{t.files.areas.tabLoadError(areas.message)}</p>}
      {areas.status === 'success' && (
        <CommonAreasList propertyId={propertyId} areas={areas.data.common_areas} canEdit={canEdit} onChanged={() => setReload((value) => value + 1)} />
      )}
      <SharesTable key={sharesKey} units={units} canEdit={canEdit} onSaved={onUnitsChanged} />
    </div>
  );
}
