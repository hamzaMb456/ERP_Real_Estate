import { describe, expect, it } from 'vitest';
import { gapLabel, gapLink, groupGaps, type GapRow } from './gaps';

const unitGap = (code: string): GapRow => ({
  entity_type: 'unit',
  entity_id: 'u1',
  property_id: 'p1',
  entity_label: 'B-101',
  property_label: 'Résidence',
  gap_code: code,
});

describe('gapLink', () => {
  it('sends each gap to the exact place to fix it', () => {
    expect(gapLink(unitGap('no_owner'))).toBe('/erp/biens/p1/unites/u1#proprietaires');
    expect(gapLink(unitGap('no_surface'))).toBe('/erp/biens/p1/unites/u1#modifier');
    const property = { entity_type: 'property', entity_id: 'p1', property_id: 'p1', entity_label: 'Résidence', property_label: null } as const;
    expect(gapLink({ ...property, gap_code: 'no_position' })).toBe('/erp/biens/p1/modifier');
    expect(gapLink({ ...property, gap_code: 'shares_total' })).toBe('/erp/biens/p1#parties-communes');
    expect(
      gapLink({ entity_type: 'contact', entity_id: 'c1', property_id: null, entity_label: 'X', property_label: null, gap_code: 'no_contact_info' }),
    ).toBe('/erp/contacts/c1/modifier');
  });
});

describe('gapLabel', () => {
  it('names known gaps and keeps unknown codes', () => {
    expect(gapLabel('no_owner')).toBe('Aucun propriétaire');
    expect(gapLabel('mystery')).toBe('mystery');
  });
});

describe('groupGaps', () => {
  it('groups gaps per record inside each entity type', () => {
    const groups = groupGaps([unitGap('no_owner'), unitGap('no_rent')]);
    expect(groups.unit).toEqual([
      { entityId: 'u1', label: 'B-101', context: 'Résidence', gaps: [unitGap('no_owner'), unitGap('no_rent')] },
    ]);
    expect(groups.property).toEqual([]);
    expect(groups.contact).toEqual([]);
  });
});
