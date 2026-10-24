import 'server-only';

// Same default as scripts/apply-hasura-permissions.mjs / check-hasura.mjs.
const HASURA_URL = process.env.HASURA_URL ?? 'https://rxcugiymqkyghsuixmhi.hasura.eu-central-1.nhost.run';

/**
 * Runs raw SQL as the Postgres admin, via Hasura's /v2/query endpoint. Only for app_storage_files
 * (see db/migrations/0013_storage_ownership.sql) — that table is deliberately never tracked/exposed
 * in the GraphQL schema (it's internal bookkeeping for a security trigger, not app-facing data), so
 * GraphQL mutations can't reach it even with the admin secret; SQL is the correct access path.
 * Never pass unvalidated input here — build `sql` only from values already checked by the caller
 * (uuid-shape, a fixed bucket allowlist, etc.), since this has no parameter binding.
 */
export async function hasuraRunSql(sql: string): Promise<void> {
  const secret = process.env.HASURA_ADMIN_SECRET;
  if (!secret) throw new Error('HASURA_ADMIN_SECRET not configured');
  const response = await fetch(`${HASURA_URL}/v2/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hasura-admin-secret': secret },
    body: JSON.stringify({ type: 'run_sql', args: { source: 'default', sql } }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Hasura run_sql failed: HTTP ${response.status} ${body}`);
  }
}
