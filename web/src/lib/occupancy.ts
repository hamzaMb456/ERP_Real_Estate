export type OccupancyLevel = 'none' | 'empty' | 'partial' | 'full';

export const OCCUPANCY: Record<OccupancyLevel, { label: string; color: string }> = {
  full: { label: 'Entièrement loué', color: '#047857' },
  partial: { label: 'Partiellement loué', color: '#d97706' },
  empty: { label: 'Aucune unité louée', color: '#dc2626' },
  none: { label: 'Sans unité', color: '#6b7280' },
};

export function occupancyLevel(statuses: string[]): OccupancyLevel {
  if (statuses.length === 0) return 'none';
  const rented = statuses.filter((status) => status === 'rented').length;
  if (rented === 0) return 'empty';
  return rented === statuses.length ? 'full' : 'partial';
}
