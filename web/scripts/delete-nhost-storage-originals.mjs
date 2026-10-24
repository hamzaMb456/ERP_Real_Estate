// One-off, run once after backfill-floci-storage.mjs has copied everything into Floci and it was
// verified working: permanently deletes the original files from real Nhost Storage. Irreversible.
//
// Usage (PowerShell), from web/:
//   $env:HASURA_ADMIN_SECRET = "<admin secret from the Nhost dashboard>"
//   node scripts/delete-nhost-storage-originals.mjs

const HASURA_URL = process.env.HASURA_URL ?? 'https://rxcugiymqkyghsuixmhi.hasura.eu-central-1.nhost.run';
const SUBDOMAIN = process.env.NHOST_SUBDOMAIN ?? 'rxcugiymqkyghsuixmhi';
const REGION = process.env.NHOST_REGION ?? 'eu-central-1';
const SECRET = process.env.HASURA_ADMIN_SECRET;
if (!SECRET) {
  console.error('Set HASURA_ADMIN_SECRET first.');
  process.exit(1);
}

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

const linked = await gql(`query { property_files { storage_file_id } lease_files { storage_file_id } }`);
const ids = [...new Set([...linked.property_files, ...linked.lease_files].map((row) => row.storage_file_id))];
console.log(`${ids.length} distinct storage_file_id to delete from real Nhost Storage.`);

let deleted = 0;
let skipped = 0;
const failed = [];
for (const id of ids) {
  const url = `https://${SUBDOMAIN}.storage.${REGION}.nhost.run/v1/files/${id}`;
  try {
    const res = await fetch(url, { method: 'DELETE', headers: { 'x-hasura-admin-secret': SECRET } });
    if (res.status === 404) {
      skipped++;
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text()}`);
    deleted++;
    console.log(`deleted ${id}`);
  } catch (error) {
    failed.push({ id, reason: String(error) });
  }
}

console.log(`\nDone: ${deleted} deleted, ${skipped} already gone, ${failed.length} failed.`);
if (failed.length > 0) {
  console.log(failed);
  process.exit(1);
}
