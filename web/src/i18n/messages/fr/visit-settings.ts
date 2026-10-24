// Admin setting (administration > Visites): how a visitor pays the unit's visit fee. Column: organizations.visit_payment_method
// (migration 0011), null = free (no payment method chosen).

export const visitSettings = {
  title: 'Visites',
  description: 'Choisissez comment un visiteur paie les frais de visite lorsqu’un bien en demande.',
  methodLabel: 'Mode de paiement des visites',
  methods: {
    virtual: 'Virtuel',
    manual: 'Manuel',
    none: 'Gratuit',
  },
  save: 'Enregistrer',
  saved: 'Préférence enregistrée.',
  saveFailed: 'Échec de l’enregistrement.',
};
