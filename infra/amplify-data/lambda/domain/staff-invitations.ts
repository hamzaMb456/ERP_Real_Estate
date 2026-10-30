// Invitation links for new regional staff. The token is signed with a server secret, not stored: the invitation row
// keeps only its id, expiry and used/revoked marks, so a copy of the database cannot produce a valid link.
// Every failure looks the same ({ ok: false }) so a link cannot be probed to learn why it failed.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const INVITATION_TTL_HOURS = 24;

export interface InvitationRow {
  id: string;
  expires_at: string;
  used_at?: string | null;
  revoked_at?: string | null;
}

export type TokenCheck = { ok: true; id: string } | { ok: false };

const FAILED: TokenCheck = { ok: false };

/** A new invitation id and its expiry, 24 hours from now. */
export function newInvitation(now: Date): { id: string; expires_at: string } {
  return { id: randomUUID(), expires_at: new Date(now.getTime() + INVITATION_TTL_HOURS * 3_600_000).toISOString() };
}

const signature = (secret: string, id: string, expiresAt: string): string =>
  createHmac('sha256', secret).update(`${id}.${expiresAt}`).digest('hex');

/** `<invitation id>.<hex signature>`, signed over the id and the expiry. */
export function signToken(secret: string, id: string, expiresAt: string): string {
  return `${id}.${signature(secret, id, expiresAt)}`;
}

/** Valid only if the signature matches the row's own id and expiry, and the row is unexpired, unused and not revoked. */
export function checkToken(secret: string, token: string, row: InvitationRow | undefined, now: Date): TokenCheck {
  if (!secret || !row || typeof token !== 'string') return FAILED;
  const dot = token.indexOf('.');
  if (dot <= 0 || token.slice(0, dot) !== row.id) return FAILED;
  const given = Buffer.from(token.slice(dot + 1));
  const wanted = Buffer.from(signature(secret, row.id, row.expires_at));
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) return FAILED;
  if (row.used_at || row.revoked_at) return FAILED;
  if (new Date(row.expires_at).getTime() <= now.getTime()) return FAILED;
  return { ok: true, id: row.id };
}

/** What the web server sends to prove the authenticator code was verified. Only the servers hold the secret. */
export function confirmationProof(secret: string, invitationId: string): string {
  return createHmac('sha256', secret).update(`confirm.${invitationId}`).digest('hex');
}

export function proofMatches(secret: string, invitationId: string, proof: string): boolean {
  if (!secret || !proof) return false;
  const given = Buffer.from(proof);
  const wanted = Buffer.from(confirmationProof(secret, invitationId));
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}
