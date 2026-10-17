import { describe, expect, it } from 'vitest';
import { isRetryable, toUserMessage } from './errors';

describe('toUserMessage', () => {
  it('explains a share total above 100 % with the date', () => {
    const error = new Error('Check constraint violation. ownership_shares_exceeded:15/03/2026');
    expect(toUserMessage(error)).toBe('Le total des parts dépasse 100 % à partir du 15/03/2026.');
  });

  it('explains an overlapping period for the same owner', () => {
    const error = new Error('conflicting key value violates exclusion constraint "ownerships_no_overlap"');
    expect(toUserMessage(error)).toBe('Ce propriétaire détient déjà cette unité sur cette période.');
  });

  it('explains an end date before the start date', () => {
    const error = new Error('new row violates check constraint "ownerships_dates_check"');
    expect(toUserMessage(error)).toBe('La date de fin doit suivre la date de début.');
  });

  it('names the duplicate unit reference when known', () => {
    const error = new Error('duplicate key value violates unique constraint "units_property_id_code_key"');
    expect(toUserMessage(error, { unitCode: 'B-101' })).toBe('La référence B-101 existe déjà dans ce bien.');
    expect(toUserMessage(error)).toBe('Cette référence existe déjà dans ce bien.');
  });

  it('explains a file that cannot be linked', () => {
    const error = new Error('Check constraint violation. invalid_storage_file');
    expect(toUserMessage(error)).toBe('Ce fichier ne peut pas être rattaché. Envoyez-le à nouveau.');
  });

  it('explains a network failure', () => {
    expect(toUserMessage(new TypeError('Failed to fetch'))).toBe(
      'Connexion impossible. Vérifiez votre réseau puis réessayez.',
    );
  });

  it('explains a permission refusal', () => {
    const error = new Error('check constraint of an insert permission has failed');
    expect(toUserMessage(error)).toBe('Vous n’avez pas les droits pour cette action.');
  });

  it.each([
    ['lease_overlap:12', 'Cette unité est déjà louée sur cette période (bail N° 12).'],
    ['lease_needs_renter', 'Ajoutez au moins un locataire avant d’activer le bail.'],
    ['lease_needs_unit', 'Ajoutez au moins une unité avant d’activer le bail.'],
    ['lease_needs_rent', 'Indiquez le loyer de chaque unité avant d’activer le bail.'],
    ['lease_not_draft', 'Ce bail ne peut plus être modifié.'],
    ['lease_not_active', 'Ce bail ne peut plus être modifié.'],
    ['lease_not_found', 'Ce bail est introuvable.'],
    ['lease_forbidden', 'Vous n’avez pas les droits pour cette action.'],
    ['lease_renewal_not_after', 'La nouvelle date de fin doit être postérieure à la fin actuelle du bail.'],
    ['lease_end_before_start', 'La date de fin doit suivre la date de début.'],
    ['new row violates check constraint "leases_dates_check"', 'La date de fin doit suivre la date de début.'],
    ['lease_end_in_future', 'La date de fin du bail ne peut pas être dans le futur.'],
    ['lease_rent_before_start', 'Le loyer ne peut pas commencer avant le début du bail.'],
    ['lease_draft_only', 'Les unités d’un bail ne peuvent être modifiées que tant qu’il est en brouillon.'],
    ['lease_unit_not_found', 'Cette unité ne fait pas partie du bail.'],
    ['lease_signed_in_future', 'La date de signature ne peut pas être dans le futur.'],
    ['new row violates check constraint "leases_registration_check"', 'La date d’enregistrement ne peut pas précéder la signature.'],
    ['duplicate key value violates unique constraint "lease_rents_lease_id_unit_id_effective_from_key"', 'Un loyer existe déjà à cette date pour cette unité.'],
  ])('explains lease error %s', (message, expected) => {
    expect(toUserMessage(new Error(message))).toBe(expected);
  });

  it.each([
    [
      'appointment_staff_invalid',
      'Ce collaborateur ne peut pas mener de rendez-vous : choisissez un gestionnaire ou un administrateur actif de l’organisation.',
    ],
    [
      'Uniqueness violation. duplicate key value violates unique constraint "appointment_participants_pkey"',
      'Un même contact ne peut participer qu’une fois au rendez-vous.',
    ],
    ['new row violates check constraint "appointments_dates_check"', 'La date de fin doit suivre la date de début.'],
  ])('explains appointment error %s', (message, expected) => {
    expect(toUserMessage(new Error(message))).toBe(expected);
  });

  it('does not treat an appointment business error as retryable', () => {
    expect(isRetryable(new Error('appointment_staff_invalid'))).toBe(false);
  });

  it('keeps an unknown message and handles non-errors', () => {
    expect(toUserMessage(new Error('Something odd'))).toBe('Something odd');
    expect(toUserMessage(new Error(''))).toBe('Erreur inconnue.');
    expect(toUserMessage('nope')).toBe('Erreur inconnue.');
  });
});

describe('isRetryable', () => {
  it('retries network and permission failures only', () => {
    expect(isRetryable(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetryable(new Error('check constraint of an insert permission has failed'))).toBe(true);
    expect(isRetryable(new Error('lease_overlap:3'))).toBe(false);
    expect(isRetryable('nope')).toBe(false);
  });
});
