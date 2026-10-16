import { describe, expect, it, vi } from 'vitest';
import { createHasuraClient } from '../_lib/hasura';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('createHasuraClient', () => {
  it('posts the query with the admin secret and returns data', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ data: { ok: 1 } }));
    const client = createHasuraClient({ url: 'http://h/v1/graphql', adminSecret: 'adm', fetch: fetchFn as unknown as typeof fetch });
    const data = await client.request<{ ok: number }>('query { ok }', { a: 1 });
    expect(data).toEqual({ ok: 1 });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://h/v1/graphql');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['x-hasura-admin-secret']).toBe('adm');
    expect(JSON.parse(init.body as string)).toEqual({ query: 'query { ok }', variables: { a: 1 } });
  });

  it('throws the GraphQL messages joined', async () => {
    const fetchFn = async () => jsonResponse({ errors: [{ message: 'boom' }, { message: 'bang' }] });
    const client = createHasuraClient({ url: 'u', adminSecret: 'a', fetch: fetchFn as unknown as typeof fetch });
    await expect(client.request('q')).rejects.toThrow('boom; bang');
  });

  it('throws on a non-2xx answer without GraphQL errors, without leaking the secret', async () => {
    const fetchFn = async () => new Response('bad gateway', { status: 502 });
    const client = createHasuraClient({ url: 'u', adminSecret: 'topsecret', fetch: fetchFn as unknown as typeof fetch });
    const error = await client.request('q').catch((e: Error) => e);
    expect((error as Error).message).toContain('502');
    expect((error as Error).message).not.toContain('topsecret');
  });
});
