// Labels of the codes stored in the database (types, statuses, roles). The codes never change; only their labels do.

export const labels = {
  propertyTypes: { building: 'Immeuble', house: 'Maison', plot: 'Terrain' } as Record<string, string>,
  unitTypes: {
    apartment: 'Appartement',
    office: 'Bureau',
    shop: 'Commerce',
    parking: 'Parking',
    house: 'Maison',
    land: 'Terrain',
  } as Record<string, string>,
  unitStatuses: {
    vacant: 'Disponible',
    rented: 'Loué',
    for_sale: 'À vendre',
    sold: 'Vendu',
    under_maintenance: 'En travaux',
  } as Record<string, string>,
  areaKinds: {
    stairs: 'Escaliers',
    lift: 'Ascenseur',
    garden: 'Jardin',
    roof: 'Toiture / terrasse',
    parking: 'Parking commun',
    other: 'Autre',
  } as Record<string, string>,
  contactRoles: {
    owner: { label: 'Propriétaire', description: 'Possède un bien ou une unité que nous gérons.' },
    renter: { label: 'Locataire', description: 'Loue une unité avec un bail.' },
    buyer: { label: 'Acquéreur', description: 'Achète une unité ou a fait une offre.' },
  } as Record<string, { label: string; description: string }>,
  /** Display names of the governorates, keyed by the stored French name. Missing keys show the stored name. */
  governorates: {} as Record<string, string>,
};
