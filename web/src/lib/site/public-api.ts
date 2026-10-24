import 'server-only';

// Unauthenticated GraphQL access for the public front office (Hasura role "public"). No session, no Authorization
// header: the role is only what the database views and the Hasura permissions expose.
// clientQuery sends the user's JWT for mutations that require a signed-in client (Hasura role "user").

import { PUBLIC_TOKEN, appsyncRequest, dataBackend } from '@/lib/backend';

export { publicImageUrl } from './image-url';

export function publicGraphqlUrl(): string {
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  return `https://${subdomain}.graphql.${region}.nhost.run/v1`;
}

const PUBLIC_QUERY_TIMEOUT_MS = 8000;

type GraphqlReply<T> = { data?: T | null; errors?: { message: string }[] };

/** Runs a query as the public role. Throws on a network/HTTP failure, on GraphQL errors and on an empty reply. */
export async function publicQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  if (dataBackend() === 'appsync') {
    return appsyncRequest<T>(query, variables, PUBLIC_TOKEN, { signal: AbortSignal.timeout(PUBLIC_QUERY_TIMEOUT_MS) });
  }
  const response = await fetch(publicGraphqlUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    // A hung backend must fail fast: callers turn the failure into an empty result.
    signal: AbortSignal.timeout(PUBLIC_QUERY_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Public GraphQL request failed with HTTP ${response.status}`);
  }
  const reply = (await response.json()) as GraphqlReply<T>;
  if (reply.errors?.length) {
    throw new Error(reply.errors.map((error) => error.message).join(' · '));
  }
  if (!reply.data) {
    throw new Error('Public GraphQL request returned no data');
  }
  return reply.data;
}

/**
 * Runs a mutation as a signed-in client (Hasura role "user"). Passes the visitor's JWT so Hasura sets the
 * `hasura.user` session variable, which the database functions check before accepting a request.
 */
export async function clientQuery<T>(accessToken: string, query: string, variables: Record<string, unknown>): Promise<T> {
  if (dataBackend() === 'appsync') {
    return appsyncRequest<T>(query, variables, accessToken, { signal: AbortSignal.timeout(PUBLIC_QUERY_TIMEOUT_MS) });
  }
  const response = await fetch(publicGraphqlUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(PUBLIC_QUERY_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Client GraphQL request failed with HTTP ${response.status}`);
  }
  const reply = (await response.json()) as GraphqlReply<T>;
  if (reply.errors?.length) {
    throw new Error(reply.errors.map((error) => error.message).join(' · '));
  }
  if (!reply.data) {
    throw new Error('Client GraphQL request returned no data');
  }
  return reply.data;
}
