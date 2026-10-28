import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appsyncRequest, cleanError, operationOf } from './backend';

describe('cleanError', () => {
  it('keeps the resolver code and drops the Lambda stack trace', () => {
    const raw = 'The Lambda data source function failed: {"errorType":"DomainError","errorMessage":"lease_overlap:3","trace":["at /var/task/index.js:1"]}';
    expect(cleanError(raw)).toBe('lease_overlap:3');
    expect(cleanError('plain message')).toBe('plain message');
    expect(cleanError('The Lambda data source function failed: {broken')).toBe('server_error');
  });
});

describe('operationOf', () => {
  it('reads the kind and the name, ignoring leading whitespace', () => {
    expect(operationOf('\n  query PublicCities($where: x) { a }')).toEqual({ kind: 'query', name: 'PublicCities' });
    expect(operationOf('mutation EndLease { b }')).toEqual({ kind: 'mutation', name: 'EndLease' });
  });

  it('refuses anonymous operations', () => {
    expect(() => operationOf('{ units { id } }')).toThrow(/without a name/);
    expect(() => operationOf('query { units { id } }')).toThrow(/without a name/);
  });
});

describe('appsyncRequest', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv('APPSYNC_URL', 'http://appsync.test/graphql');
    vi.stubGlobal('fetch', fetchMock);
    // Server side by default (tests run in jsdom, where window exists).
    vi.stubGlobal('window', undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('sends the operation by name with a raw token and returns the parsed shape', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { run: '{"cities":[{"city":"Tunis"}]}' } })));
    const data = await appsyncRequest<{ cities: { city: string }[] }>('query PublicCities($w: x) { c }', { w: 1 }, 'public');
    expect(data).toEqual({ cities: [{ city: 'Tunis' }] });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('public');
    const body = JSON.parse(init.body as string);
    expect(body.variables).toEqual({ op: 'PublicCities', v: '{"w":1}' });
    expect(body.query).toContain('run(op: $op');
  });

  it('uses exec for mutations and surfaces the backend error message (codes the UI maps)', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { exec: null }, errors: [{ message: 'The Lambda data source function failed: lease_not_draft' }] })));
    await expect(appsyncRequest('mutation ActivateLease { a }', {}, 'jwt')).rejects.toThrow(/lease_not_draft/);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string).query).toContain('exec(op: $op');
  });

  it('in the browser, goes through the same-origin route with the original query', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: { units: [] } })));
    expect(await appsyncRequest('query Units { u }', { a: 1 }, 'jwt')).toEqual({ units: [] });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/data');
    expect(JSON.parse(init.body as string)).toEqual({ query: 'query Units { u }', variables: { a: 1 } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'lease_not_draft' }), { status: 400 }));
    await expect(appsyncRequest('mutation EndLease { e }', {}, 'jwt')).rejects.toThrow('lease_not_draft');
  });

  it('turns a 401 into a permission error', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(appsyncRequest('query Units { u }', {}, 'expired')).rejects.toThrow(/permission/);
  });
});
