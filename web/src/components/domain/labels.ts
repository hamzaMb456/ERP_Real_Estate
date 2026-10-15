export const PROPERTY_TYPES: Record<string, string> = { building: 'Immeuble', house: 'Maison', plot: 'Terrain' };

export const UNIT_TYPES: Record<string, string> = {
  apartment: 'Appartement',
  office: 'Bureau',
  shop: 'Commerce',
  parking: 'Parking',
  house: 'Maison',
  land: 'Terrain',
};

export const UNIT_STATUSES: Record<string, string> = {
  vacant: 'Disponible',
  rented: 'Loué',
  for_sale: 'À vendre',
  sold: 'Vendu',
  under_maintenance: 'En travaux',
};

export const GOVERNORATES = [
  'Ariana',
  'Béja',
  'Ben Arous',
  'Bizerte',
  'Gabès',
  'Gafsa',
  'Jendouba',
  'Kairouan',
  'Kasserine',
  'Kébili',
  'Le Kef',
  'Mahdia',
  'La Manouba',
  'Médenine',
  'Monastir',
  'Nabeul',
  'Sfax',
  'Sidi Bouzid',
  'Siliana',
  'Sousse',
  'Tataouine',
  'Tozeur',
  'Tunis',
  'Zaghouan',
] as const;

export const AREA_KINDS: Record<string, string> = {
  stairs: 'Escaliers',
  lift: 'Ascenseur',
  garden: 'Jardin',
  roof: 'Toiture / terrasse',
  parking: 'Parking commun',
  other: 'Autre',
};
