// Turns data-layer error messages into the sentences staff see, in the interface language.
// One place, so every page words the same failure the same way. Sentences live in src/i18n/messages/*/errors.ts.

import { getMessages } from '@/i18n/store';
import { formatDate } from '@/lib/ownership';

type ErrorContext = { unitCode?: string };

const NETWORK = /failed to fetch|networkerror|network request failed|load failed/i;
const PERMISSION = /permission|not found in type|access-denied/i;

const LEASE_OVERLAP = /lease_overlap:(\d+)/;

export function toUserMessage(error: unknown, context: ErrorContext = {}): string {
  const t = getMessages().errors;
  if (!(error instanceof Error)) return t.unknown;
  const message = error.message;

  const shares = /ownership_shares_exceeded:(\d{2})\/(\d{2})\/(\d{4})/.exec(message);
  if (shares) return t.sharesExceeded(formatDate(`${shares[3]}-${shares[2]}-${shares[1]}`));
  if (message.includes('ownerships_no_overlap')) return t.ownershipOverlap;
  if (message.includes('ownerships_dates_check')) return t.endBeforeStart;
  if (message.includes('invalid_storage_file')) return t.invalidStorageFile;
  if (message.includes('unit_not_deletable')) return t.unitNotDeletable;
  if (message.includes('units_property_id_code_key')) {
    return context.unitCode ? t.unitCodeTaken(context.unitCode) : t.unitCodeTakenGeneric;
  }
  const overlap = LEASE_OVERLAP.exec(message);
  if (overlap) return t.leaseOverlap(overlap[1]);
  const lease = (Object.keys(t.lease) as (keyof typeof t.lease)[]).find((needle) => message.includes(needle));
  if (lease) return t.lease[lease];
  const appointment = (Object.keys(t.appointment) as (keyof typeof t.appointment)[]).find((needle) => message.includes(needle));
  if (appointment) return t.appointment[appointment];
  const access = (Object.keys(t.access) as (keyof typeof t.access)[]).find((needle) => message.includes(needle));
  if (access) return t.access[access];
  if (NETWORK.test(message)) return t.network;
  if (PERMISSION.test(message)) return t.permission;
  return message || t.unknown;
}

/** Network and permission failures are worth a second try; business-rule failures are not. */
export function isRetryable(error: unknown): boolean {
  return error instanceof Error && (NETWORK.test(error.message) || PERMISSION.test(error.message));
}
