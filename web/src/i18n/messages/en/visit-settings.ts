import type { visitSettings as fr } from '../fr/visit-settings';

export const visitSettings: typeof fr = {
  title: 'Visits',
  description: 'Choose how a visitor pays the visit fee when a listing asks for one.',
  methodLabel: 'Visit payment method',
  methods: {
    virtual: 'Online',
    manual: 'Manual',
    none: 'Free',
  },
  save: 'Save',
  saved: 'Preference saved.',
  saveFailed: 'Could not save.',
};
