import type { visitSettings as fr } from '../fr/visit-settings';

export const visitSettings: typeof fr = {
  title: 'Visits',
  description: 'Choose how a visitor pays the visit fee when a listing asks for one.',
  methodLabel: 'Visit payment method',
  methods: {
    virtual: 'Remote (bank transfer, D17, Flouci…)',
    manual: 'On site (cash to the agent)',
    none: 'Free',
  },
  instructionsLabel: 'How to pay remotely',
  instructionsPlaceholder: 'E.g.: bank transfer to RIB TN59 ..., or D17 at 71 000 000.',
  instructionsHelp: 'This text is shown to the client as written, once their visit is confirmed. Required for the "remote" method.',
  instructionsRequired: 'Explain how to pay remotely before saving this method.',
  save: 'Save',
  saved: 'Preference saved.',
  saveFailed: 'Could not save.',
};
