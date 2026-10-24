import { describe, expect, it } from 'vitest';
import { filterUnits, unitBlockers, unitHeading, unitMatches, unitPrice, type UnitCardData, type UnitFilters } from '@/lib/units';

const base: UnitCardData = {
  id: 'u1',
  code: 'B-102',
  type: 'apartment',
  floor: 1,
  rooms: 4,
  surface_m2: '110.00',
  rent_amount: '1100.000',
  sale_price: null,
  status: 'vacant',
  archived_at: null,
  show_on_website: true,
  title: null,
  property: { id: 'p1', name: 'Les Jardins de Carthage', city: 'Carthage', archived_at: null },
  photos: [{ storage_file_id: 'f1' }],
  photoCount: { aggregate: { count: 2 } },
  current_lease: [],
  current_owners: [],
};
const all: UnitFilters = { search: '', status: 'all', propertyId: 'all', website: 'all', showArchived: false };

describe('unit overview helpers', () => {
  it('headlines a unit with its reference and its bien', () => {
    expect(unitHeading(base)).toBe('B-102 · Les Jardins de Carthage');
  });

  it('prices a unit for sale at its sale price and anything else at its rent', () => {
    expect(unitPrice({ ...base, status: 'for_sale', sale_price: 395000 })).toEqual({ amount: 395000, monthly: false });
    expect(unitPrice(base)).toEqual({ amount: '1100.000', monthly: true });
  });

  it('counts the unit photos for the website rule', () => {
    expect(unitBlockers(base)).toEqual([]);
    expect(unitBlockers({ ...base, photoCount: { aggregate: { count: 0 } } })).toEqual(['no_photo']);
    expect(unitBlockers({ ...base, photoCount: { aggregate: null } })).toEqual(['no_photo']);
    expect(unitBlockers({ ...base, status: 'rented' })).toEqual(['status']);
  });

  it('searches the reference, titles, bien, city, tenants and owners', () => {
    const unit: UnitCardData = {
      ...base,
      title: 'Bright S+3',
      current_lease: [{ renter_names: 'Mehdi Trabelsi', end_date: '2026-12-31' }],
      current_owners: [{ contact: { id: 'c1', full_name: 'Hédi Ben Salem' } }],
    };
    for (const needle of ['b-102', 'bright', 'jardins', 'carthage', 'trabelsi', 'ben salem', '  ']) {
      expect(unitMatches(unit, needle), needle).toBe(true);
    }
    expect(unitMatches(unit, 'zzz')).toBe(false);
  });

  it('hides archived units and units of archived biens unless asked', () => {
    const archivedUnit = { ...base, id: 'u2', archived_at: '2026-10-01T00:00:00Z' };
    const archivedBien = { ...base, id: 'u3', property: { ...base.property, archived_at: '2026-10-01T00:00:00Z' } };
    const units = [base, archivedUnit, archivedBien];
    expect(filterUnits(units, all).map((unit) => unit.id)).toEqual(['u1']);
    expect(filterUnits(units, { ...all, showArchived: true })).toHaveLength(3);
  });

  it('filters by status, bien and website state', () => {
    const rented = { ...base, id: 'u2', status: 'rented' };
    const other = { ...base, id: 'u3', property: { ...base.property, id: 'p2' } };
    const units = [base, rented, other];
    expect(filterUnits(units, { ...all, status: 'rented' }).map((unit) => unit.id)).toEqual(['u2']);
    expect(filterUnits(units, { ...all, propertyId: 'p2' }).map((unit) => unit.id)).toEqual(['u3']);
    expect(filterUnits(units, { ...all, website: 'online' }).map((unit) => unit.id)).toEqual(['u1', 'u3']);
    expect(filterUnits(units, { ...all, website: 'offline' }).map((unit) => unit.id)).toEqual(['u2']);
  });
});
