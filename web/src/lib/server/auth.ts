import 'server-only';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/** Mirrors web/src/lib/use-can-edit.ts — roles allowed to write storage files. */
const WRITER_ROLES = new Set(['org_admin', 'manager']);

function jwksUrl(): URL {
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  return new URL(`https://${subdomain}.auth.${region}.nhost.run/v1/.well-known/jwks.json`);
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  jwks ??= createRemoteJWKSet(jwksUrl());
  return jwks;
}

export type SessionClaims = { userId: string; role: string; token: string };

/** Verifies the bearer token from an Authorization header against Nhost's JWKS. Throws if missing or invalid. */
export async function requireSession(authHeader: string | null): Promise<SessionClaims> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;
  if (!token) throw new Error('unauthorized');
  const { payload } = await jwtVerify(token, getJwks());
  const claims = payload['https://hasura.io/jwt/claims'] as Record<string, unknown> | undefined;
  const role = typeof claims?.['x-hasura-default-role'] === 'string' ? (claims['x-hasura-default-role'] as string) : '';
  const userId = typeof payload.sub === 'string' ? payload.sub : '';
  if (!userId) throw new Error('unauthorized');
  return { userId, role, token };
}

/** Throws unless the session role may write storage files. */
export function requireWriter(session: SessionClaims): void {
  if (!WRITER_ROLES.has(session.role)) throw new Error('forbidden');
}
