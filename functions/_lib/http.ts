import type { CoreResult } from './runtime';

/** The Express-style request Nhost passes to a function. */
export type FnRequest = {
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};

export type FnResponse = {
  status(code: number): { json(body: unknown): void };
};

/** Runs a pure core and writes its result; an unexpected throw becomes a generic 500 so Nhost retries. */
export async function respond(res: FnResponse, run: () => Promise<CoreResult>): Promise<void> {
  let result: CoreResult;
  try {
    result = await run();
  } catch (error) {
    console.error('function failed:', error instanceof Error ? error.message : 'unknown error');
    result = { status: 500, body: { error: 'internal_error' } };
  }
  res.status(result.status).json(result.body);
}
