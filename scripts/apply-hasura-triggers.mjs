// Creates the cron trigger of the daily lease job and the event triggers of the e-mail functions,
// through the Hasura Metadata API. Additive and idempotent: it (re)creates only the four triggers named
// below (replace: true) and never touches any other trigger or the rest of the metadata.
//
// Usage (PowerShell):
//   $env:HASURA_ADMIN_SECRET = "<admin secret from the Nhost dashboard>"
//   node scripts/apply-hasura-triggers.mjs            (or --dry-run to print the bodies and send nothing)
//
// The function URL and the webhook secret are NOT read here: Hasura resolves them from its own
// environment when it calls the functions ({{NHOST_FUNCTIONS_URL}} in the URL, NHOST_WEBHOOK_SECRET for
// the header), so neither ever lands in the metadata. Nhost provides both variables to Hasura.
// Optional env: HASURA_URL (default: this project's Hasura endpoint).

const HASURA_URL =
  process.env.HASURA_URL ?? 'https://rxcugiymqkyghsuixmhi.hasura.eu-central-1.nhost.run';
const SECRET = process.env.HASURA_ADMIN_SECRET;
const DRY_RUN = process.argv.includes('--dry-run');
if (!SECRET && !DRY_RUN) {
  console.error('Set HASURA_ADMIN_SECRET first.');
  process.exit(1);
}

const source = 'default';
const table = (name) => ({ schema: 'public', name });
const fnUrl = (path) => `{{NHOST_FUNCTIONS_URL}}/${path}`;
const headers = [{ name: 'x-nhost-webhook-secret', value_from_env: 'NHOST_WEBHOOK_SECRET' }];
const retry_conf = { num_retries: 3, interval_sec: 60, timeout_sec: 60 };

// Hasura cron schedules run in UTC. Tunisia is UTC+1 all year (no daylight saving time),
// so 05:00 UTC is 06:00 Africa/Tunis every day.
const DAILY_AT_0600_TUNIS = '0 5 * * *';

const operations = [
  {
    type: 'create_cron_trigger',
    args: {
      name: 'lease_daily',
      webhook: fnUrl('lease-daily'),
      schedule: DAILY_AT_0600_TUNIS,
      payload: {},
      headers,
      retry_conf: { num_retries: 3, retry_interval_seconds: 60, timeout_seconds: 120, tolerance_seconds: 21600 },
      include_in_metadata: true,
      comment: 'Expire overdue leases, then write the daily notifications (06:00 Tunis).',
      replace: true,
    },
  },
  {
    type: 'pg_create_event_trigger',
    args: {
      source,
      name: 'notification_email',
      table: table('notifications'),
      insert: { columns: '*' },
      webhook: fnUrl('send-notification-email'),
      headers,
      retry_conf,
      replace: true,
    },
  },
  {
    // Insert: invitation. Update of email_status: « Renvoyer » (the function acts only when it became pending).
    type: 'pg_create_event_trigger',
    args: {
      source,
      name: 'appointment_invitation',
      table: table('appointment_participants'),
      insert: { columns: '*' },
      update: { columns: ['email_status'] },
      webhook: fnUrl('send-appointment-email'),
      headers,
      retry_conf,
      replace: true,
    },
  },
  {
    type: 'pg_create_event_trigger',
    args: {
      source,
      name: 'appointment_changed',
      table: table('appointments'),
      // notify_by_email: switching it on after creation invites the participants (the function decides).
      update: { columns: ['starts_at', 'ends_at', 'location', 'status', 'notify_by_email'] },
      webhook: fnUrl('send-appointment-email'),
      headers,
      retry_conf,
      replace: true,
    },
  },
];

if (DRY_RUN) {
  for (const op of operations) console.log(JSON.stringify(op, null, 2));
  const crons = operations.filter((op) => op.type === 'create_cron_trigger').length;
  console.log(`Dry run: ${crons} cron trigger, ${operations.length - crons} event triggers. Nothing sent.`);
  process.exit(0);
}

async function metadata(body) {
  const res = await fetch(`${HASURA_URL}/v1/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-hasura-admin-secret': SECRET },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

// One operation per request: each one makes Hasura rebuild its schema (see apply-hasura-permissions.mjs).
for (const op of operations) {
  const result = await metadata(op);
  if (!result.ok) {
    console.error(`Failed on ${op.args.name}:`, result.status, JSON.stringify(result.json, null, 2));
    process.exit(1);
  }
  console.log(`  ${op.args.name}: ok`);
}
console.log(`Applied ${operations.length} triggers.`);
