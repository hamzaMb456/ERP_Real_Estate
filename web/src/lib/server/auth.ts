import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/** Mirrors web/src/lib/use-can-edit.ts — roles allowed to write records and storage files. */
const WRITER_ROLES = new Set(['org_admin', 'manager']);

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  jwks ??= createRemoteJWKSet(new URL(requiredEnv('AUTH_JWKS_URL')));
  return jwks;
}

export type SessionClaims = { userId: string; role: string; token: string; orgId: string };

/** Verifies a Cognito ID token from an Authorization header. Throws if missing or invalid. */
export async function requireSession(authHeader: string | null): Promise<SessionClaims> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) throw new Error('unauthorized');
  const { payload } = await jwtVerify(token, getJwks(), {
    algorithms: ['RS256'],
    issuer: requiredEnv('AUTH_JWT_ISSUER'),
    audience: requiredEnv('AUTH_CLIENT_ID'),
  });
  const role = typeof payload['custom:role'] === 'string' ? payload['custom:role'] : '';
  const userId = typeof payload.sub === 'string' ? payload.sub : '';
  if (!userId) throw new Error('unauthorized');
  const orgId = typeof payload['custom:org_id'] === 'string' ? payload['custom:org_id'] : '';
  return { userId, role, token, orgId };
}

/** Throws unless the session role may write storage files (managers and org admins; viewers only read). */
export function requireWriter(session: SessionClaims): void {
  if (!WRITER_ROLES.has(session.role)) throw new Error('forbidden');
}
