import { plural } from '../../plural';

export const site = {
  meta: {
    title: 'Emerald Immobilier — Homes for rent and for sale in Tunisia',
    description:
      'Emerald Immobilier, a licensed real estate agency in Tunisia: find an apartment, a villa or a premises to rent or to buy.',
  },
  skipToContent: 'Skip to content',
  brand: 'Emerald Immobilier',
  homeLabel: 'Emerald Immobilier — Home',
  nav: {
    label: 'Main navigation',
    rent: 'Rent',
    buy: 'Buy',
    howItWorks: 'How it works',
    contact: 'Contact',
    clientArea: 'Client area',
  },
  menu: {
    open: 'Open the menu',
    close: 'Close the menu',
    title: 'Menu',
    description: 'Emerald Immobilier site navigation',
  },
  footer: {
    description: 'Your real estate agency in Tunisia: rentals, sales and support from start to finish.',
    trustBadge: 'Licensed real estate agency — Tunisia',
    contactTitle: 'Contact',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    linksTitle: 'Useful links',
    legalNotice: 'Legal notice',
    privacy: 'Privacy',
    language: 'Language',
    copyright: '© 2026 Emerald Immobilier Tunisie. All rights reserved.',
  },
  notFound: {
    title: 'Page not found',
    description: 'This page does not exist or is no longer available. Have a look at our homes instead.',
    cta: 'See homes for rent',
    home: 'Back to home',
  },
  listingCard: {
    available: 'Available',
    availableFrom: (date: string) => `From ${date}`,
    perMonth: '/ month',
    rooms: (count: number) => plural(count, { one: '# room', other: '# rooms' }),
    floor: (floor: string) => `Floor ${floor}`,
    groundFloor: 'Ground floor',
    photoAlt: (title: string) => `Photo: ${title}`,
    noPhoto: 'Photo not available',
    favourite: 'Add to favourites',
    soon: 'Coming soon',
  },
};
