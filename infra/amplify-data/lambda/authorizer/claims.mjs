const ORG_ROLES = new Set(['org_admin', 'manager', 'viewer']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CACHE_SECONDS = 300;

/** AppSync caches an allow decision per token: never past the token's own expiry. */
export function cacheSeconds(exp, nowSeconds = Math.floor(Date.now() / 1000)) {
  return Math.max(0, Math.min(MAX_CACHE_SECONDS, Math.floor(exp - nowSeconds)));
}

export const PUBLIC_CONTEXT = Object.freeze({ role: 'public', userId: '', orgId: '' });

/**
 * Map a verified Cognito ID token payload to the AppSync resolverContext. An organization role keeps its name;
 * a client account (custom:role "client") acts as the "user" role. Returns null when the token
 * cannot act on the API: unknown role, no user, or an organization role without an organization.
 */
export function toResolverContext(payload) {
  const attributeRole = payload?.['custom:role'];
  const role = ORG_ROLES.has(attributeRole) ? attributeRole : attributeRole === 'client' ? 'user' : null;
  const userId = payload?.sub;
  const orgId = payload?.['custom:org_id'] ?? '';

  if (!role || typeof userId !== 'string' || userId === '') return null;
  if (orgId !== '' && !(typeof orgId === 'string' && UUID.test(orgId))) return null;
  if (ORG_ROLES.has(role) && !orgId) return null;
  return { role, userId, orgId };
}
