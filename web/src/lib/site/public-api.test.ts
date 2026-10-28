import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { publicImageUrl, publicQuery } from './public-api';

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

describe('public api', () => {
  beforeEach(() => {
    vi.stubEnv('APPSYNC_URL', 'http://appsync.test/graphql');
    // Server side (no window): the request goes straight to AppSync.
    vi.stubGlobal('window', undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('builds the image url from the storage bucket', () => {
    vi.stubEnv('NEXT_PUBLIC_STORAGE_URL', 'http://storage.test');
    expect(publicImageUrl('abc', 640)).toBe('http://storage.test/property-files/abc');
  });

  it('encodes the file id', () => {
    vi.stubEnv('NEXT_PUBLIC_STORAGE_URL', 'http://storage.test');
    expect(publicImageUrl('a/b?c', 100)).toBe('http://storage.test/property-files/a%2Fb%3Fc');
  });

  it('sends the public token and returns the parsed data', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { run: '{"ok":1}' } }));
    vi.stubGlobal('fetch', fetchMock);

    const data = await publicQuery<{ ok: number }>('query Q($a: Int) { x }', { a: 1 });

    expect(data).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://appsync.test/graphql');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('public');
    const body = JSON.parse(init.body as string);
    expect(body.variables).toEqual({ op: 'Q', v: '{"a":1}' });
  });

  it('passes an abort signal so a hung backend fails fast', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { run: '{}' } }));
    vi.stubGlobal('fetch', fetchMock);

    await publicQuery('query Q { x }', {});

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal?.aborted).toBe(false);
  });

  it('rejects when the response carries GraphQL errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ errors: [{ message: 'role public not found' }] })));
    await expect(publicQuery('query Q { x }', {})).rejects.toThrow('role public not found');
  });

  it('rejects on an HTTP failure and on an empty reply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('boom', { status: 502 })));
    await expect(publicQuery('query Q { x }', {})).rejects.toThrow('502');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    await expect(publicQuery('query Q { x }', {})).rejects.toThrow();
  });
});
