import { PUBLIC_TOKEN, appsyncRequest } from '@/lib/backend';
import { getSession } from '@/lib/auth/session';
import { assertWritable } from '@/lib/write-freeze';

export async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  assertWritable(query);
  return appsyncRequest<T>(query, variables, getSession()?.accessToken ?? PUBLIC_TOKEN);
}
