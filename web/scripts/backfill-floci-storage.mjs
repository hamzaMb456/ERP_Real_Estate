// One-off: copies every file byte-for-byte from real Nhost Storage into the local Floci S3 buckets,
// and inserts the matching app_storage_files row (db/migrations/0013_storage_ownership.sql) so
// presign/delete keep working for files uploaded before storage.ts moved off Nhost Storage.
// Idempotent: skips any storage_file_id that already has an app_storage_files row.
//
// Usage (PowerShell), from web/:
//   $env:HASURA_ADMIN_SECRET = "<admin secret from the Nhost dashboard>"
//   node scripts/backfill-floci-storage.mjs
//
// Optional env: HASURA_URL, NHOST_SUBDOMAIN, NHOST_REGION, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
// (same defaults as the app itself — see src/lib/server/s3-client.ts, src/lib/server/hasura-admin.ts).

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const HASURA_URL = process.env.HASURA_URL ?? 'https://rxcugiymqkyghsuixmhi.hasura.eu-central-1.nhost.run';
const SUBDOMAIN = process.env.NHOST_SUBDOMAIN ?? 'rxcugiymqkyghsuixmhi';
const REGION = process.env.NHOST_REGION ?? 'eu-central-1';
const SECRET = process.env.HASURA_ADMIN_SECRET;
if (!SECRET) {
  console.error('Set HASURA_ADMIN_SECRET first.');
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:4566',
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'test',
  },
});

async function gql(query, variables = {}) {
  const res = await fetch(`${HASURA_URL}/v1/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hasura-admin-secret': SECRET },
    body: JSON.stringify({ query, variables }),
  });
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data;
}

async function runSql(sql) {
  const res = await fetch(`${HASURA_URL}/v2/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hasura-admin-secret': SECRET },
    body: JSON.stringify({ type: 'run_sql', args: { source: 'default', sql } }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`run_sql failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

const linked = await gql(`
  query { property_files { storage_file_id } lease_files { storage_file_id } }
`);
const ids = [...new Set([...linked.property_files, ...linked.lease_files].map((row) => row.storage_file_id))];
console.log(`${ids.length} distinct storage_file_id referenced by property_files/lease_files.`);
if (ids.length === 0) process.exit(0);

const already = await runSql(`select id from public.app_storage_files where id in (${ids.map((id) => `'${id}'`).join(',')})`);
const alreadyIds = new Set((already.result ?? []).slice(1).map((row) => row[0]));

const { files } = await gql(
  `query Files($ids: [uuid!]!) { files(where: { id: { _in: $ids } }) { id bucketId uploadedByUserId mimeType } }`,
  { ids },
);
const byId = new Map(files.map((f) => [f.id, f]));

let copied = 0;
let skipped = 0;
const failed = [];
for (const id of ids) {
  if (alreadyIds.has(id)) {
    skipped++;
    continue;
  }
  const meta = byId.get(id);
  if (!meta) {
    failed.push({ id, reason: 'no storage.files row (never uploaded, or already deleted)' });
    continue;
  }
  try {
    const downloadUrl = `https://${SUBDOMAIN}.storage.${REGION}.nhost.run/v1/files/${id}`;
    const fileRes = await fetch(downloadUrl, { headers: { 'x-hasura-admin-secret': SECRET } });
    if (!fileRes.ok) throw new Error(`download HTTP ${fileRes.status}`);
    const bytes = Buffer.from(await fileRes.arrayBuffer());

    await s3.send(
      new PutObjectCommand({ Bucket: meta.bucketId, Key: id, Body: bytes, ContentType: meta.mimeType || 'application/octet-stream' }),
    );
    await runSql(
      `insert into public.app_storage_files (id, bucket, uploaded_by_user_id) values ('${id}', '${meta.bucketId}', '${meta.uploadedByUserId}')`,
    );
    copied++;
    console.log(`copied ${id} (${meta.bucketId}, ${bytes.length} bytes)`);
  } catch (error) {
    failed.push({ id, reason: String(error) });
  }
}

console.log(`\nDone: ${copied} copied, ${skipped} already present, ${failed.length} failed.`);
if (failed.length > 0) {
  console.log(failed);
  process.exit(1);
}
