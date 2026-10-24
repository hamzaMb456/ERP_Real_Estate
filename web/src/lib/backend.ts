// Which data backend the app talks to. NEXT_PUBLIC_DATA_BACKEND=appsync sends every existing GraphQL
// operation, by its name, to the AppSync API on Floci; anything else keeps Hasura (Nhost). The AppSync
// side answers with the same JSON shape Hasura did, so callers do not change.

export type DataBackend = 'hasura' | 'appsync';

export function dataBackend(): DataBackend {
  return process.env.NEXT_PUBLIC_DATA_BACKEND === 'appsync' ? 'appsync' : 'hasura';
}

/** The token the public site sends when there is no session (the authorizer maps it to role "public"). */
export const PUBLIC_TOKEN = 'public';

const OPERATION = /^\s*(query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/;
const RUN = 'query Run($op: String!, $v: AWSJSON) { run(op: $op, variables: $v) }';
const EXEC = 'mutation Exec($op: String!, $v: AWSJSON) { exec(op: $op, variables: $v) }';

export type Operation = { kind: 'query' | 'mutation'; name: string };

/** Every operation the app sends must be named: the name is how the backend finds its resolver. */
export function operationOf(query: string): Operation {
  const match = OPERATION.exec(query);
  if (!match) throw new Error('GraphQL operation without a name');
  return { kind: match[1] as Operation['kind'], name: match[2] };
}

type Reply = { data?: { run?: string | null; exec?: string | null } | null; errors?: { message: string }[] };

/** The same-origin route the browser goes through (AppSync on Floci sends no CORS headers). */
export const DATA_ROUTE = '/api/data';

const LAMBDA_FAILURE = /The Lambda data source function failed: ([\s\S]*)$/;

/**
 * Keeps only the error code a resolver threw (e.g. "lease_not_draft"): the raw AppSync message wraps it
 * in the Lambda runtime's JSON, stack trace included, which must not reach the browser.
 */
export function cleanError(message: string): string {
  const wrapped = LAMBDA_FAILURE.exec(message);
  if (!wrapped) return message;
  if (!wrapped[1].trimStart().startsWith('{')) return wrapped[1].trim();
  try {
    const parsed = JSON.parse(wrapped[1]) as { errorMessage?: unknown };
    return typeof parsed.errorMessage === 'string' ? parsed.errorMessage : 'server_error';
  } catch {
    return 'server_error';
  }
}

/** Server side: straight to AppSync (APPSYNC_URL never reaches the browser). */
async function direct<T>(query: string, variables: Record<string, unknown>, token: string, signal?: AbortSignal): Promise<T> {
  const url = process.env.APPSYNC_URL;
  if (!url) throw new Error('APPSYNC_URL is not set');
  const op = operationOf(query);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ query: op.kind === 'query' ? RUN : EXEC, variables: { op: op.name, v: JSON.stringify(variables) } }),
    signal,
  });
  if (response.status === 401) throw new Error('permission_denied: not signed in');
  if (!response.ok) throw new Error(`AppSync request failed with HTTP ${response.status}`);
  const reply = (await response.json()) as Reply;
  if (reply.errors?.length) throw new Error(reply.errors.map((error) => cleanError(error.message)).join(' · '));
  const raw = op.kind === 'query' ? reply.data?.run : reply.data?.exec;
  if (raw == null) throw new Error('AppSync request returned no data');
  return JSON.parse(raw) as T;
}

/** Browser side: through the same-origin route, which calls direct(). */
async function viaRoute<T>(query: string, variables: Record<string, unknown>, token: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(DATA_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: token },
    body: JSON.stringify({ query, variables }),
    signal,
  });
  const reply = (await response.json().catch(() => ({}))) as { data?: T; error?: string };
  if (!response.ok || reply.error) throw new Error(reply.error ?? `Data request failed with HTTP ${response.status}`);
  return reply.data as T;
}

/**
 * Sends an existing Hasura-style operation to AppSync. `token` is the raw JWT, or PUBLIC_TOKEN
 * (no "Bearer " prefix: Floci routes Bearer tokens to OIDC, not to the Lambda authorizer).
 */
export async function appsyncRequest<T>(
  query: string,
  variables: Record<string, unknown> | undefined,
  token: string,
  init: { signal?: AbortSignal } = {},
): Promise<T> {
  const send = typeof window === 'undefined' ? direct : viaRoute;
  return send<T>(query, variables ?? {}, token, init.signal);
}
