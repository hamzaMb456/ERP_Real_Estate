const NAMESPACE = 'https://hasura.io/jwt/claims';
const ROLES = new Set(['org_admin', 'manager', 'viewer', 'user']);
const STAFF_ROLES = new Set(['org_admin', 'manager', 'viewer']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CACHE_SECONDS = 300;

/** AppSync caches an allow decision per token: never past the token's own expiry. */
export function cacheSeconds(exp, nowSeconds = Math.floor(Date.now() / 1000)) {
  return Math.max(0, Math.min(MAX_CACHE_SECONDS, Math.floor(exp - nowSeconds)));
}

export const PUBLIC_CONTEXT = Object.freeze({ role: 'public', userId: '', orgId: '' });

/**
 * Map a verified Nhost (Hasura-style) JWT payload to the AppSync resolverContext.
 * Values must be strings. Returns null when the token cannot act on the API:
 * unknown role, no user, or a staff role without an organization.
 */
export function toResolverContext(payload) {
  const raw = payload?.[NAMESPACE];
  if (!raw || typeof raw !== 'object') return null;
  const claims = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.toLowerCase(), value]));

  const role = claims['x-hasura-default-role'];
  const userId = claims['x-hasura-user-id'] ?? payload.sub;
  const orgId = claims['x-hasura-org-id'] ?? '';

  if (!ROLES.has(role) || typeof userId !== 'string' || userId === '') return null;
  if (orgId !== '' && !(typeof orgId === 'string' && UUID.test(orgId))) return null;
  if (STAFF_ROLES.has(role) && !orgId) return null;
  return { role, userId, orgId };
}
