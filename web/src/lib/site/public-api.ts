import 'server-only';

// Unauthenticated GraphQL access for the public front office (Hasura role "public"). No session, no Authorization
// header: the role is only what the database views and the Hasura permissions expose.

export { publicImageUrl } from './image-url';

export function publicGraphqlUrl(): string {
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  return `https://${subdomain}.graphql.${region}.nhost.run/v1`;
}

type GraphqlReply<T> = { data?: T | null; errors?: { message: string }[] };

/** Runs a query as the public role. Throws on a network/HTTP failure, on GraphQL errors and on an empty reply. */
export async function publicQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(publicGraphqlUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
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
