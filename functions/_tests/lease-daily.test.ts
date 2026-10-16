import { afterEach, describe, expect, it, vi } from 'vitest';
import handler, { handleLeaseDaily, runLeaseDaily } from '../lease-daily';

type Call = { query: string };

function fakeClient(responses: { expired?: unknown; notified?: unknown } = {}) {
  const calls: Call[] = [];
  return {
    calls,
    client: {
      async request<T>(query: string): Promise<T> {
        calls.push({ query });
        if (query.includes('expire_overdue_leases')) {
          return { expire_overdue_leases: responses.expired ?? [{ id: 'a' }, { id: 'b' }] } as T;
        }
        const five = Array.from({ length: 5 }, (_, i) => ({ id: `n${i}` }));
        return { generate_daily_notifications: 'notified' in responses ? responses.notified : five } as T;
      },
    },
  };
}

const ENV = { NHOST_WEBHOOK_SECRET: 's3cret', HASURA_GRAPHQL_URL: 'http://h/v1/graphql', HASURA_ADMIN_SECRET: 'adm' };

describe('runLeaseDaily', () => {
  it('expires leases before generating notifications', async () => {
    const { client, calls } = fakeClient();
    await runLeaseDaily(client);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.query).toContain('expire_overdue_leases');
    // Hasura tracks only set-returning SQL functions: the mutation needs a selection set.
    expect(calls[1]?.query).toMatch(/generate_daily_notifications\s*\{\s*id\s*\}/);
  });

  it('returns the number of expired rows and of inserted notifications', async () => {
    const { client } = fakeClient();
    expect(await runLeaseDaily(client)).toEqual({ expired: 2, notified: 5 });
  });

  it('counts zero when the answer is not a row set', async () => {
    const { client } = fakeClient({ notified: null });
    expect((await runLeaseDaily(client)).notified).toBe(0);
  });
});

describe('handleLeaseDaily', () => {
  it('returns 401 and sends no query when the secret does not match', async () => {
    const { client, calls } = fakeClient();
    const out = await handleLeaseDaily({ headers: { 'x-nhost-webhook-secret': 'nope' }, env: ENV, client });
    expect(out.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('returns 401 when the header is missing', async () => {
    const { client, calls } = fakeClient();
    const out = await handleLeaseDaily({ headers: {}, env: ENV, client });
    expect(out.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it('returns 200 with the counts when the secret matches', async () => {
    const { client } = fakeClient();
    const out = await handleLeaseDaily({ headers: { 'x-nhost-webhook-secret': 's3cret' }, env: ENV, client });
    expect(out).toEqual({ status: 200, body: { expired: 2, notified: 5 } });
  });

  it('names the missing Hasura variable (never a value) with status 500', async () => {
    const env = { NHOST_WEBHOOK_SECRET: 's3cret', HASURA_ADMIN_SECRET: 'adm' };
    const out = await handleLeaseDaily({ headers: { 'x-nhost-webhook-secret': 's3cret' }, env });
    expect(out.status).toBe(500);
    expect(JSON.stringify(out.body)).toContain('HASURA_GRAPHQL_URL');
    expect(JSON.stringify(out.body)).not.toContain('s3cret');
  });
});

describe('default export (Express adapter)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('writes the core result to the response', async () => {
    vi.stubEnv('NHOST_WEBHOOK_SECRET', 's3cret');
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    await handler({ headers: { 'x-nhost-webhook-secret': 'wrong' }, body: {} }, { status });
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledOnce();
  });
});
