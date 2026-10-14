// Ownership rules the screens need before sending anything to the database.
// The database still enforces the 100 % cap; these checks give earlier, clearer messages.

export type OwnershipRow = {
  id: string;
  unit_id: string;
  contact_id: string;
  share_percent: number | string;
  starts_on: string;
  ends_on: string | null;
};

export type NewOwner = { contactId: string | null; sharePercent: number };

export type TransferPlan = {
  endIds: string[];
  endOn: string;
  objects: { unit_id: string; contact_id: string; share_percent: number; starts_on: string }[];
};

const pad = (n: number) => String(n).padStart(2, '0');

export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function dayBefore(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

export function formatDateFr(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function formatPercent(value: number | string): string {
  const rounded = Math.round(Number(value) * 100) / 100;
  return String(rounded).replace('.', ',') + ' %';
}

export function isCurrent(row: { starts_on: string; ends_on: string | null }, today: string = todayIso()): boolean {
  return row.starts_on <= today && (row.ends_on === null || row.ends_on >= today);
}

export function ownershipPhase(
  row: { starts_on: string; ends_on: string | null },
  today: string = todayIso(),
): 'past' | 'current' | 'upcoming' {
  if (row.starts_on > today) return 'upcoming';
  return isCurrent(row, today) ? 'current' : 'past';
}

export function validateNewOwners(owners: NewOwner[]): string | null {
  if (owners.length === 0) return 'Ajoutez au moins un propriétaire.';
  if (owners.some((owner) => !owner.contactId)) return 'Choisissez un contact pour chaque ligne.';
  const ids = owners.map((owner) => owner.contactId);
  if (new Set(ids).size !== ids.length) return 'Un même contact apparaît deux fois.';
  if (owners.some((owner) => !(owner.sharePercent > 0) || owner.sharePercent > 100)) {
    return 'Chaque part doit être comprise entre 0 et 100 %.';
  }
  const total = owners.reduce((sum, owner) => sum + owner.sharePercent, 0);
  if (Math.abs(total - 100) > 0.001) return `Le total des parts doit être 100 % (actuellement ${formatPercent(total)}).`;
  return null;
}

/** Ends every holding still running on `date` (day before) and starts `owners` on `date`, for each unit. */
export function planTransfer(
  unitIds: string[],
  rows: OwnershipRow[],
  date: string,
  owners: NewOwner[],
): TransferPlan | { error: string } {
  const invalid = validateNewOwners(owners);
  if (invalid) return { error: invalid };

  const running = rows.filter((row) => unitIds.includes(row.unit_id) && (row.ends_on === null || row.ends_on >= date));
  const blocking = running.find((row) => row.starts_on >= date);
  if (blocking) {
    return { error: `La date doit être postérieure au ${formatDateFr(blocking.starts_on)}, début de la détention actuelle.` };
  }

  return {
    endIds: running.map((row) => row.id),
    endOn: dayBefore(date),
    objects: unitIds.flatMap((unitId) =>
      owners.map((owner) => ({
        unit_id: unitId,
        contact_id: owner.contactId as string,
        share_percent: owner.sharePercent,
        starts_on: date,
      })),
    ),
  };
}

/** Holdings of the same unit that a planned transfer closed the day before it starts: reopen them when it is cancelled. */
export function rowsToReopen(rows: OwnershipRow[], cancelled: OwnershipRow): string[] {
  const closedOn = dayBefore(cancelled.starts_on);
  return rows
    .filter((row) => row.id !== cancelled.id && row.unit_id === cancelled.unit_id && row.ends_on === closedOn)
    .map((row) => row.id);
}
