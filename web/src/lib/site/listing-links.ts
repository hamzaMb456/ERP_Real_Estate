// Links of the unit page. Pure helpers (usable from server and client) so every outbound href is checked in one place.

/** The tour link as a normalised http(s) url, or null: the database check already enforces http(s), this is the second line. */
export function safeTourUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** `tel:` link keeping only digits and a leading plus (spaces, dots and brackets break some dialers). */
export function telHref(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  return `tel:${trimmed.startsWith('+') ? '+' : ''}${digits}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}
