// Turns database and Hasura error messages into the French sentences staff see.
// One place, so every page words the same failure the same way.

type ErrorContext = { unitCode?: string };

const NETWORK = /failed to fetch|networkerror|network request failed|load failed/i;
const PERMISSION = /permission|not found in type|access-denied/i;

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
  if (NETWORK.test(message)) return 'Connexion impossible. Vérifiez votre réseau puis réessayez.';
  if (PERMISSION.test(message)) return 'Vous n’avez pas les droits pour cette action.';
  return message || 'Erreur inconnue.';
}
