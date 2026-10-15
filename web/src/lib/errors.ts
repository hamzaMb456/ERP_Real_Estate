// Turns database and Hasura error messages into the French sentences staff see.
// One place, so every page words the same failure the same way.

type ErrorContext = { unitCode?: string };

const NETWORK = /failed to fetch|networkerror|network request failed|load failed/i;
const PERMISSION = /permission|not found in type|access-denied/i;

const LEASE_OVERLAP = /lease_overlap:(\d+)/;

// Fixed sentences for the lease functions and triggers (codes raised by db/migrations/0003_leases.sql).
const LEASE_MESSAGES: [needle: string, sentence: string][] = [
  ['lease_needs_renter', 'Ajoutez au moins un locataire avant d’activer le bail.'],
  ['lease_needs_unit', 'Ajoutez au moins une unité avant d’activer le bail.'],
  ['lease_needs_rent', 'Indiquez le loyer de chaque unité avant d’activer le bail.'],
  ['lease_not_draft', 'Ce bail ne peut plus être modifié.'],
  ['lease_not_active', 'Ce bail ne peut plus être modifié.'],
  ['lease_not_found', 'Ce bail est introuvable.'],
  ['lease_forbidden', 'Vous n’avez pas les droits pour cette action.'],
  ['lease_renewal_not_after', 'La nouvelle date de fin doit être postérieure à la fin actuelle du bail.'],
  ['lease_end_before_start', 'La date de fin doit suivre la date de début.'],
  ['leases_dates_check', 'La date de fin doit suivre la date de début.'],
  ['lease_end_in_future', 'La date de fin du bail ne peut pas être dans le futur.'],
  ['lease_rent_before_start', 'Le loyer ne peut pas commencer avant le début du bail.'],
  ['lease_draft_only', 'Les unités d’un bail ne peuvent être modifiées que tant qu’il est en brouillon.'],
  ['lease_unit_not_found', 'Cette unité ne fait pas partie du bail.'],
  ['lease_signed_in_future', 'La date de signature ne peut pas être dans le futur.'],
  ['leases_registration_check', 'La date d’enregistrement ne peut pas précéder la signature.'],
  ['lease_rents_lease_id_unit_id_effective_from_key', 'Un loyer existe déjà à cette date pour cette unité.'],
];

export function toFrenchError(error: unknown, context: ErrorContext = {}): string {
  if (!(error instanceof Error)) return 'Erreur inconnue.';
  const message = error.message;

  const shares = /ownership_shares_exceeded:(\d{2}\/\d{2}\/\d{4})/.exec(message);
  if (shares) return `Le total des parts dépasse 100 % à partir du ${shares[1]}.`;
  if (message.includes('ownerships_no_overlap')) return 'Ce propriétaire détient déjà cette unité sur cette période.';
  if (message.includes('ownerships_dates_check')) return 'La date de fin doit suivre la date de début.';
  if (message.includes('invalid_storage_file')) return 'Ce fichier ne peut pas être rattaché. Envoyez-le à nouveau.';
  if (message.includes('units_property_id_code_key')) {
    return context.unitCode
      ? `La référence ${context.unitCode} existe déjà dans ce bien.`
      : 'Cette référence existe déjà dans ce bien.';
  }
  const overlap = LEASE_OVERLAP.exec(message);
  if (overlap) return `Cette unité est déjà louée sur cette période (bail N° ${overlap[1]}).`;
  const lease = LEASE_MESSAGES.find(([needle]) => message.includes(needle));
  if (lease) return lease[1];
  if (NETWORK.test(message)) return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
  if (PERMISSION.test(message)) return 'Vous n’avez pas les droits pour cette action.';
  return message || 'Erreur inconnue.';
}

/** Network and permission failures are worth a second try; business-rule failures are not. */
export function isRetryable(error: unknown): boolean {
  return error instanceof Error && (NETWORK.test(error.message) || PERMISSION.test(error.message));
}
