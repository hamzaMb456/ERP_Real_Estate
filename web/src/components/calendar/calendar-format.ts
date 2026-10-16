import { isoToTunisParts } from '@/lib/appointments';

const longDay = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Africa/Tunis',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDay = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', day: 'numeric', month: 'short', year: 'numeric' });

/** « vendredi 16 octobre 2026 · 09:00 – 10:00 » in Tunis time. */
export function formatRange(startIso: string, endIso: string): string {
  const start = isoToTunisParts(startIso);
  const end = isoToTunisParts(endIso);
  const day = longDay.format(new Date(startIso));
  if (start.date === end.date) return `${day} · ${start.time} – ${end.time}`;
  return `${day} · ${start.time} → ${shortDay.format(new Date(endIso))} ${end.time}`;
}

/** « 16 oct. 2026 · 09:00 » in Tunis time. */
export function formatWhen(iso: string): string {
  return `${shortDay.format(new Date(iso))} · ${isoToTunisParts(iso).time}`;
}
