import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { publicGraphqlUrl, publicImageUrl, publicQuery } from './public-api';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

describe('public api', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_NHOST_SUBDOMAIN', 'xyz');
    vi.stubEnv('NEXT_PUBLIC_NHOST_REGION', 'eu-central-1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('builds the image url with width and quality', () => {
    expect(publicImageUrl('abc', 640)).toBe('https://xyz.storage.eu-central-1.nhost.run/v1/files/abc?w=640&q=80');
  });

  it('encodes the file id', () => {
    expect(publicImageUrl('a/b?c', 100)).toContain('/files/a%2Fb%3Fc?w=100');
  });

  it('builds the graphql url', () => {
    expect(publicGraphqlUrl()).toBe('https://xyz.graphql.eu-central-1.nhost.run/v1');
  });

  it('posts the query without any Authorization header and returns data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { ok: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    const data = await publicQuery<{ ok: number }>('query Q($a: Int) { x }', { a: 1 });

    expect(data).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://xyz.graphql.eu-central-1.nhost.run/v1');
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.has('authorization')).toBe(false);
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ query: 'query Q($a: Int) { x }', variables: { a: 1 } });
  });

  it('rejects when the response carries GraphQL errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: 'role public not found' }] })));
    await expect(publicQuery('query { x }', {})).rejects.toThrow('role public not found');
  });

  it('rejects on an HTTP failure and on an empty reply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 502 })));
    await expect(publicQuery('query { x }', {})).rejects.toThrow('502');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    await expect(publicQuery('query { x }', {})).rejects.toThrow();
  });
});
