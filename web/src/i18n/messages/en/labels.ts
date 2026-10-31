import type { labels as fr } from '../fr/labels';

export const labels: typeof fr = {
  propertyTypes: { building: 'Building', house: 'House', plot: 'Plot' },
  unitTypes: {
    apartment: 'Apartment',
    office: 'Office',
    shop: 'Shop',
    parking: 'Parking',
    house: 'House',
    land: 'Land',
  },
  unitStatuses: {
    vacant: 'Available for rent',
    rented: 'Rented',
    for_sale: 'For sale',
    sold: 'Sold',
    under_maintenance: 'Under works',
  },
  areaKinds: {
    stairs: 'Stairs',
    lift: 'Lift',
    garden: 'Garden',
    roof: 'Roof / terrace',
    parking: 'Shared parking',
    other: 'Other',
  },
  contactRoles: {
    owner: { label: 'Owner', description: 'Owns a property or a unit we manage.' },
    renter: { label: 'Renter', description: 'Rents a unit under a lease.' },
    buyer: { label: 'Buyer', description: 'Is buying a unit or has made an offer.' },
  },
  governorates: {},
};
