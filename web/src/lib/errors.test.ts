import { describe, expect, it } from 'vitest';
import { toFrenchError } from './errors';

describe('toFrenchError', () => {
  it('explains a share total above 100 % with the date', () => {
    const error = new Error('Check constraint violation. ownership_shares_exceeded:15/03/2026');
    expect(toFrenchError(error)).toBe('Le total des parts dépasse 100 % à partir du 15/03/2026.');
  });

  it('explains an overlapping period for the same owner', () => {
    const error = new Error('conflicting key value violates exclusion constraint "ownerships_no_overlap"');
    expect(toFrenchError(error)).toBe('Ce propriétaire détient déjà cette unité sur cette période.');
  });

  it('explains an end date before the start date', () => {
    const error = new Error('new row violates check constraint "ownerships_dates_check"');
    expect(toFrenchError(error)).toBe('La date de fin doit suivre la date de début.');
  });

  it('names the duplicate unit reference when known', () => {
    const error = new Error('duplicate key value violates unique constraint "units_property_id_code_key"');
    expect(toFrenchError(error, { unitCode: 'B-101' })).toBe('La référence B-101 existe déjà dans ce bien.');
    expect(toFrenchError(error)).toBe('Cette référence existe déjà dans ce bien.');
  });

  it('explains a file that cannot be linked', () => {
    const error = new Error('Check constraint violation. invalid_storage_file');
    expect(toFrenchError(error)).toBe('Ce fichier ne peut pas être rattaché. Envoyez-le à nouveau.');
  });

  it('explains a network failure', () => {
    expect(toFrenchError(new TypeError('Failed to fetch'))).toBe(
      'Connexion impossible. Vérifiez votre réseau puis réessayez.',
    );
  });

  it('explains a permission refusal', () => {
    const error = new Error('check constraint of an insert permission has failed');
    expect(toFrenchError(error)).toBe('Vous n’avez pas les droits pour cette action.');
  });

  it('keeps an unknown message and handles non-errors', () => {
    expect(toFrenchError(new Error('Something odd'))).toBe('Something odd');
    expect(toFrenchError(new Error(''))).toBe('Erreur inconnue.');
    expect(toFrenchError('nope')).toBe('Erreur inconnue.');
  });
});
