import 'server-only';

// Unauthenticated GraphQL access for the public front office: the authorizer maps the literal public
// token to role "public". clientQuery sends the signed-in client's ID token.

import { PUBLIC_TOKEN, appsyncRequest } from '@/lib/backend';

export { publicImageUrl } from './image-url';

const PUBLIC_QUERY_TIMEOUT_MS = 8000;

/** Runs a query as the public role. Throws on a network/HTTP failure, on GraphQL errors and on an empty reply. */
export async function publicQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  return appsyncRequest<T>(query, variables, PUBLIC_TOKEN, { signal: AbortSignal.timeout(PUBLIC_QUERY_TIMEOUT_MS) });
}

/** Runs an operation as a signed-in client, with the caller's token. */
export async function clientQuery<T>(accessToken: string, query: string, variables: Record<string, unknown>): Promise<T> {
  return appsyncRequest<T>(query, variables, accessToken, { signal: AbortSignal.timeout(PUBLIC_QUERY_TIMEOUT_MS) });
}
