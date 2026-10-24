import { createRemoteJWKSet, jwtVerify } from 'jose';
import { PUBLIC_CONTEXT, cacheSeconds, toResolverContext } from './claims.mjs';

// Server-side public site calls (no session) send this literal token.
const PUBLIC_TOKEN = 'public';
const jwks = createRemoteJWKSet(new URL(process.env.JWKS_URL ?? ''));

type AuthorizerEvent = { authorizationToken?: string };

export const handler = async (event: AuthorizerEvent) => {
  // Send the raw JWT: Floci routes `Authorization: Bearer ...` to OIDC/Cognito, not to this Lambda.
  const token = (event.authorizationToken ?? '').replace(/^Bearer\s+/i, '');
  if (token === PUBLIC_TOKEN) return { isAuthorized: true, resolverContext: PUBLIC_CONTEXT };
  try {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'sub'],
      ...(process.env.JWT_ISSUER ? { issuer: process.env.JWT_ISSUER } : {}),
    });
    const resolverContext = toResolverContext(payload);
    if (!resolverContext) return { isAuthorized: false };
    return { isAuthorized: true, resolverContext, ttlOverride: cacheSeconds(payload.exp as number) };
  } catch (err) {
    console.warn('authorizer: rejected token:', (err as Error).message);
    return { isAuthorized: false };
  }
};
