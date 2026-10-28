export type Env = Record<string, string | undefined>;
export type CoreResult = { status: number; body: unknown };
export type Resolved<T> = { ok: true; value: T } | { ok: false; result: CoreResult };

/** Status 500 naming the variable only, never its value. */
export function missingVariable(name: string): CoreResult {
  return { status: 500, body: { error: 'missing_env', variable: name } };
}
