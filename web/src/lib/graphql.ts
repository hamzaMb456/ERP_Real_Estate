import { nhost } from '@/lib/nhost';

export async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await nhost.graphql.request<T>({ query, variables });
  const { data, errors } = response.body;
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join(' · '));
  }
  if (!data) {
    throw new Error('Réponse vide du serveur.');
  }
  return data;
}
