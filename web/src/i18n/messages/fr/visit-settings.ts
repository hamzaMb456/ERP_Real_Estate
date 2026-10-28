// Admin setting (administration > Visites): how a visitor pays the unit's visit fee. Column: organizations.visit_payment_method
// (migration 0011), null = free (no payment method chosen).

export const visitSettings = {
  title: 'Visites',
  description: 'Choisissez comment un visiteur paie les frais de visite lorsqu’un bien en demande.',
  methodLabel: 'Mode de paiement des visites',
  methods: {
    virtual: 'À distance (virement, D17, Flouci…)',
    manual: 'Sur place (espèces à l’agent)',
    none: 'Gratuit',
  },
  instructionsLabel: 'Comment payer à distance',
  instructionsPlaceholder: 'Ex. : virement sur le RIB TN59 ..., ou D17 au 71 000 000.',
  instructionsHelp: 'Ce texte est montré tel quel au client une fois sa visite confirmée. Obligatoire pour le mode « à distance ».',
  instructionsRequired: 'Expliquez comment payer à distance avant d’enregistrer ce mode.',
  save: 'Enregistrer',
  saved: 'Préférence enregistrée.',
  saveFailed: 'Échec de l’enregistrement.',
};
