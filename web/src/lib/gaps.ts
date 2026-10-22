import { getMessages } from '@/i18n/store';

export type GapEntity = 'property' | 'unit' | 'contact';

export type GapRow = {
  entity_type: GapEntity;
  entity_id: string;
  property_id: string | null;
  entity_label: string;
  property_label: string | null;
  gap_code: string;
};

export type GapGroup = { entityId: string; label: string; context: string | null; gaps: GapRow[] };

export function gapLabel(code: string): string {
  const labels: Record<string, string> = getMessages().properties.gaps.codes;
  return labels[code] ?? code;
}

/** Where to go to fix the gap: the exact form, tab or dialog. */
export function gapLink(row: GapRow): string {
  switch (row.entity_type) {
    case 'unit': {
      const base = `/erp/biens/${row.property_id}/unites/${row.entity_id}`;
      return row.gap_code === 'no_owner' ? base + '#proprietaires' : base + '#modifier';
    }
    case 'property':
      return row.gap_code === 'shares_total' ? `/erp/biens/${row.entity_id}#parties-communes` : `/erp/biens/${row.entity_id}/modifier`;
    case 'contact':
      return `/erp/contacts/${row.entity_id}/modifier`;
  }
}

export function groupGaps(rows: GapRow[]): Record<GapEntity, GapGroup[]> {
  const result: Record<GapEntity, GapGroup[]> = { property: [], unit: [], contact: [] };
  const index = new Map<string, GapGroup>();
  for (const row of rows) {
    const key = row.entity_type + ':' + row.entity_id;
    let group = index.get(key);
    if (!group) {
      group = { entityId: row.entity_id, label: row.entity_label, context: row.property_label, gaps: [] };
      index.set(key, group);
      result[row.entity_type].push(group);
    }
    group.gaps.push(row);
  }
  return result;
}
