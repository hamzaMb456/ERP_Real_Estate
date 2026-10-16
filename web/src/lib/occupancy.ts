export type OccupancyLevel = 'none' | 'empty' | 'partial' | 'full';

/** Pin colours per level; the labels live in the dictionary (properties.map.occupancy). */
export const OCCUPANCY: Record<OccupancyLevel, { color: string }> = {
  full: { color: '#047857' },
  partial: { color: '#d97706' },
  empty: { color: '#dc2626' },
  none: { color: '#6b7280' },
};

export function occupancyLevel(statuses: string[]): OccupancyLevel {
  if (statuses.length === 0) return 'none';
  const rented = statuses.filter((status) => status === 'rented').length;
  if (rented === 0) return 'empty';
  return rented === statuses.length ? 'full' : 'partial';
}
