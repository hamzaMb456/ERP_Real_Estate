import { createHasuraClient, type HasuraClient } from './hasura';

export type Env = Record<string, string | undefined>;
export type CoreResult = { status: number; body: unknown };
export type Resolved<T> = { ok: true; value: T } | { ok: false; result: CoreResult };

/** Status 500 naming the variable only, never its value. */
export function missingVariable(name: string): CoreResult {
  return { status: 500, body: { error: 'missing_env', variable: name } };
}

export function resolveClient(env: Env, injected?: HasuraClient): Resolved<HasuraClient> {
  if (injected) return { ok: true, value: injected };
  const url = env.HASURA_GRAPHQL_URL;
  if (!url) return { ok: false, result: missingVariable('HASURA_GRAPHQL_URL') };
  const adminSecret = env.HASURA_ADMIN_SECRET;
  if (!adminSecret) return { ok: false, result: missingVariable('HASURA_ADMIN_SECRET') };
  return { ok: true, value: createHasuraClient({ url, adminSecret }) };
}
