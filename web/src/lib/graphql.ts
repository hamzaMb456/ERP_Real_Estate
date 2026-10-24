import { getMessages } from '@/i18n/store';
import { PUBLIC_TOKEN, appsyncRequest, dataBackend } from '@/lib/backend';
import { nhost } from '@/lib/nhost';

export async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  if (dataBackend() === 'appsync') {
    return appsyncRequest<T>(query, variables, nhost.getUserSession()?.accessToken ?? PUBLIC_TOKEN);
  }
  const response = await nhost.graphql.request<T>({ query, variables });
  const { data, errors } = response.body;
  if (errors?.length) {
    throw new Error(errors.map((error) => error.message).join(' · '));
  }
  if (!data) {
    throw new Error(getMessages().common.emptyServerReply);
  }
  return data;
}
