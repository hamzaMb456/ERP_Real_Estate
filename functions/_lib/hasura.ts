export type HasuraClient = {
  request<T>(query: string, variables?: Record<string, unknown>): Promise<T>;
};

type GraphqlAnswer = { data?: unknown; errors?: Array<{ message?: string }> };

export function createHasuraClient(options: {
  url: string;
  adminSecret: string;
  fetch?: typeof fetch;
}): HasuraClient {
  const doFetch = options.fetch ?? fetch;
  return {
    async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
      const response = await doFetch(options.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hasura-admin-secret': options.adminSecret,
        },
        body: JSON.stringify({ query, variables }),
      });
      const answer = (await response.json().catch(() => ({}))) as GraphqlAnswer;
      if (answer.errors && answer.errors.length > 0) {
        throw new Error(answer.errors.map((e) => e.message ?? 'erreur GraphQL').join('; '));
      }
      if (!response.ok) {
        throw new Error(`Hasura HTTP ${response.status}`);
      }
      return answer.data as T;
    },
  };
}
