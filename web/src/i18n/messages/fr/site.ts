// Public front office (vitrine): shell, navigation, footer and 404. Later slices add their sections to this namespace.

export const site = {
  meta: {
    title: 'Emerald Immobilier — Location et vente de logements en Tunisie',
    description:
      'Emerald Immobilier, agence immobilière agréée en Tunisie : trouvez un appartement, une villa ou un local à louer ou à acheter.',
  },
  skipToContent: 'Aller au contenu',
  brand: 'Emerald Immobilier',
  homeLabel: 'Emerald Immobilier — Accueil',
  nav: {
    label: 'Navigation principale',
    rent: 'Louer',
    buy: 'Acheter',
    howItWorks: 'Comment ça marche',
    contact: 'Contact',
    clientArea: 'Espace client',
  },
  menu: {
    open: 'Ouvrir le menu',
    close: 'Fermer le menu',
    title: 'Menu',
    description: 'Navigation du site Emerald Immobilier',
  },
  footer: {
    description: 'Votre agence immobilière en Tunisie : location, vente et accompagnement de A à Z.',
    trustBadge: 'Agence immobilière agréée — Tunisie',
    contactTitle: 'Contact',
    address: 'Adresse',
    phone: 'Téléphone',
    email: 'E-mail',
    linksTitle: 'Liens utiles',
    legalNotice: 'Mentions légales',
    privacy: 'Confidentialité',
    language: 'Langue',
    copyright: '© 2026 Emerald Immobilier Tunisie. Tous droits réservés.',
  },
  notFound: {
    title: 'Page introuvable',
    description: 'Cette page n’existe pas ou n’est plus disponible. Découvrez plutôt nos logements.',
    cta: 'Voir les logements à louer',
    home: 'Retour à l’accueil',
  },
};
