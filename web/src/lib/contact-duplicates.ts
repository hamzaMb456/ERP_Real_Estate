// Finds contacts that look like the one being typed (same CIN, e-mail or phone).
// Staff are warned, never blocked: two people can share a phone or an e-mail.

export type DuplicateCandidate = {
  id: string;
  full_name: string;
  national_id: string | null;
  email: string | null;
  phone: string | null;
};

export type DuplicateField = 'national_id' | 'email' | 'phone';
export type DuplicateMatch = { contact: DuplicateCandidate; fields: DuplicateField[] };
type DuplicateInput = { national_id: string; email: string; phone: string };

const normalizeText = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

/** Keeps the 8 local digits of a Tunisian number, whatever the spacing or +216 / 00216 prefix. */
export function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? '').replace(/\D/g, '');
  if (digits.length > 8 && digits.startsWith('00216')) return digits.slice(5);
  if (digits.length > 8 && digits.startsWith('216')) return digits.slice(3);
  return digits;
}

export function formatTnPhone(digits: string): string {
  return digits.length === 8 ? `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}` : digits;
}

export function findDuplicates(input: DuplicateInput, candidates: DuplicateCandidate[], excludeId?: string): DuplicateMatch[] {
  const nationalId = normalizeText(input.national_id);
  const email = normalizeText(input.email);
  const phone = normalizePhone(input.phone);

  return candidates
    .filter((candidate) => candidate.id !== excludeId)
    .map((candidate) => {
      const fields: DuplicateField[] = [];
      if (nationalId && normalizeText(candidate.national_id) === nationalId) fields.push('national_id');
      if (email && normalizeText(candidate.email) === email) fields.push('email');
      if (phone.length >= 8 && normalizePhone(candidate.phone) === phone) fields.push('phone');
      return { contact: candidate, fields };
    })
    .filter((match) => match.fields.length > 0);
}

/** Row-filter (where) clause that fetches possible duplicates; `findDuplicates` then keeps exact matches only. */
export function duplicateWhere(input: DuplicateInput): Record<string, unknown> | null {
  const conditions: Record<string, unknown>[] = [];
  if (input.national_id.trim()) conditions.push({ national_id: { _ilike: input.national_id.trim() } });
  if (input.email.trim()) conditions.push({ email: { _ilike: input.email.trim() } });
  const phone = normalizePhone(input.phone);
  if (phone.length >= 8) conditions.push({ phone: { _ilike: '%' + phone.split('').join('%') } });
  return conditions.length > 0 ? { _or: conditions } : null;
}
