#!/usr/bin/env node
// Logical backup / restore drill for the Floci data (DynamoDB tables of one stack + the app's S3 buckets).
//   node scripts/backup.mjs backup <apiId> [outDir]   read-only on Floci; writes a backup folder
//   node scripts/backup.mjs drill  <backupDir>        restores into scratch tables + a scratch bucket, compares
//                                                     them with the backup AND the live data, deletes the scratch
//
// Why: Floci runs in `memory` storage mode unless FLOCI_STORAGE_MODE is set, so a restart loses everything.
// The backup is also the escape hatch for any later storage-mode change.
// Not included on purpose: Secrets Manager (it holds the SMTP password: keep that in a password manager),
// CloudFormation / Lambda / AppSync (rebuilt by `npm run deploy`), CDK asset buckets.
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  BatchWriteItemCommand, CreateTableCommand, DeleteTableCommand, DescribeTableCommand, DynamoDBClient,
  ListTablesCommand, QueryCommand, ScanCommand, waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import {
  CreateBucketCommand, DeleteBucketCommand, DeleteObjectCommand, GetBucketCorsCommand, GetObjectCommand, ListObjectsV2Command,
  PutBucketCorsCommand, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { DescribeSecretCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

process.env.AWS_ENDPOINT_URL ??= 'http://localhost:4566';
const credentials = { accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test' };
const region = process.env.AWS_REGION ?? 'us-east-1';
const dynamo = new DynamoDBClient({ region, endpoint: process.env.AWS_ENDPOINT_URL, credentials });
const s3 = new S3Client({ region, endpoint: process.env.AWS_ENDPOINT_URL, credentials, forcePathStyle: true });

// The app's own buckets (web S3_BUCKET names); everything else on Floci is CDK / Lambda plumbing.
const APP_BUCKETS = ['property-files', 'lease-files'];
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function listTables(apiId) {
  const names = [];
  let ExclusiveStartTableName;
  do {
    const page = await dynamo.send(new ListTablesCommand({ ExclusiveStartTableName }));
    names.push(...(page.TableNames ?? []));
    ExclusiveStartTableName = page.LastEvaluatedTableName;
  } while (ExclusiveStartTableName);
  return names.filter((n) => n.split('-')[1] === apiId).sort();
}

async function scanAll(TableName) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await dynamo.send(new ScanCommand({ TableName, ExclusiveStartKey, ConsistentRead: true }));
    items.push(...(page.Items ?? []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

async function describe(TableName) {
  const { Table } = await dynamo.send(new DescribeTableCommand({ TableName }));
  return {
    name: TableName,
    keySchema: Table.KeySchema,
    attributeDefinitions: Table.AttributeDefinitions,
    gsis: (Table.GlobalSecondaryIndexes ?? []).map((g) => ({ IndexName: g.IndexName, KeySchema: g.KeySchema, Projection: g.Projection })),
  };
}

async function listObjects(Bucket) {
  const out = [];
  let ContinuationToken;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket, ContinuationToken }));
    out.push(...(page.Contents ?? []));
    ContinuationToken = page.NextContinuationToken;
  } while (ContinuationToken);
  return out;
}

async function getObject(Bucket, Key) {
  const res = await s3.send(new GetObjectCommand({ Bucket, Key }));
  return { body: Buffer.from(await res.Body.transformToByteArray()), contentType: res.ContentType ?? 'application/octet-stream' };
}

// ---- backup ---------------------------------------------------------------------------------------
async function backup(apiId, outRoot) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(outRoot ?? join(homedir(), 'Backups', 'floci'), stamp);
  await mkdir(join(dir, 'tables'), { recursive: true });
  const manifest = { createdAt: new Date().toISOString(), apiId, tables: [], buckets: [] };

  for (const name of await listTables(apiId)) {
    const items = await scanAll(name);
    await writeFile(join(dir, 'tables', `${name}.jsonl`), items.map((i) => JSON.stringify(i)).join('\n'));
    manifest.tables.push({ ...(await describe(name)), count: items.length });
    console.log(`table  ${name.padEnd(48)} ${String(items.length).padStart(5)} items`);
  }

  for (const Bucket of APP_BUCKETS) {
    const objects = [];
    for (const o of await listObjects(Bucket).catch(() => [])) {
      const { body, contentType } = await getObject(Bucket, o.Key);
      const target = join(dir, 's3', Bucket, ...o.Key.split('/'));
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, body);
      objects.push({ key: o.Key, size: body.length, sha256: sha256(body), contentType });
    }
    const cors = await s3.send(new GetBucketCorsCommand({ Bucket })).then((r) => r.CORSRules, () => null);
    manifest.buckets.push({ name: Bucket, objects, cors });
    console.log(`bucket ${Bucket.padEnd(48)} ${String(objects.length).padStart(5)} objects`);
  }

  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nbackup written to ${dir}`);
  return dir;
}

// ---- drill ----------------------------------------------------------------------------------------
const canonical = (items) => items.map((i) => JSON.stringify(i, Object.keys(i).sort())).sort();

async function readJsonl(file) {
  const text = await readFile(file, 'utf8');
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

async function putBatch(TableName, items) {
  for (let i = 0; i < items.length; i += 25) {
    let RequestItems = { [TableName]: items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } })) };
    for (let attempt = 0; attempt < 5 && Object.keys(RequestItems).length; attempt += 1) {
      const res = await dynamo.send(new BatchWriteItemCommand({ RequestItems }));
      RequestItems = res.UnprocessedItems ?? {};
    }
  }
}

async function drill(dir) {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  const scratch = `drill${randomBytes(3).toString('hex')}`;
  const created = [];
  let bucket = null;
  const problems = [];
  const ok = (cond, msg) => { if (!cond) problems.push(msg); };

  try {
    for (const t of manifest.tables) {
      const TableName = `${scratch}-${t.name}`;
      await dynamo.send(new CreateTableCommand({
        TableName,
        KeySchema: t.keySchema,
        AttributeDefinitions: t.attributeDefinitions,
        BillingMode: 'PAY_PER_REQUEST',
        ...(t.gsis.length ? { GlobalSecondaryIndexes: t.gsis } : {}),
      }));
      created.push(TableName);
      await waitUntilTableExists({ client: dynamo, maxWaitTime: 60 }, { TableName });
      const items = await readJsonl(join(dir, 'tables', `${t.name}.jsonl`));
      ok(items.length === t.count, `${t.name}: file has ${items.length} items, manifest says ${t.count}`);
      await putBatch(TableName, items);
      const restored = await scanAll(TableName);
      ok(restored.length === t.count, `${t.name}: restored ${restored.length} of ${t.count}`);
      ok(JSON.stringify(canonical(restored)) === JSON.stringify(canonical(items)), `${t.name}: restored items differ from the backup`);
      // GSIs must answer too (an item without its index key is invisible there, as in the live tables).
      for (const g of t.gsis) {
        const keyAttr = g.KeySchema.find((k) => k.KeyType === 'HASH').AttributeName;
        const sample = items.find((i) => i[keyAttr]);
        if (!sample) continue;
        const res = await dynamo.send(new QueryCommand({
          TableName, IndexName: g.IndexName, KeyConditionExpression: '#k = :v',
          ExpressionAttributeNames: { '#k': keyAttr }, ExpressionAttributeValues: { ':v': sample[keyAttr] },
        }));
        ok((res.Items ?? []).length > 0, `${t.name}: index ${g.IndexName} returned nothing for a known key`);
      }
      // Live data must still match what was backed up (only meaningful right after a backup).
      const live = await scanAll(t.name).catch(() => null);
      if (live) ok(JSON.stringify(canonical(live)) === JSON.stringify(canonical(items)), `${t.name}: live table changed since the backup (not a restore error)`);
      console.log(`table  ${t.name.padEnd(48)} restored ${restored.length}/${t.count}`);
    }

    bucket = `${scratch}-restore`;
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    for (const b of manifest.buckets) {
      for (const o of b.objects) {
        const body = await readFile(join(dir, 's3', b.name, ...o.key.split('/')));
        ok(sha256(body) === o.sha256, `${b.name}/${o.key}: backup file does not match its recorded sha256`);
        await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `${b.name}/${o.key}`, Body: body, ContentType: o.contentType }));
        const back = await getObject(bucket, `${b.name}/${o.key}`);
        ok(sha256(back.body) === o.sha256 && back.contentType === o.contentType, `${b.name}/${o.key}: restored object differs`);
        const live = await getObject(b.name, o.key).catch(() => null);
        if (live) ok(sha256(live.body) === o.sha256, `${b.name}/${o.key}: live object changed since the backup (not a restore error)`);
      }
      console.log(`bucket ${b.name.padEnd(48)} restored ${b.objects.length}/${b.objects.length} (sha256 verified)`);
    }
  } finally {
    for (const TableName of created) await dynamo.send(new DeleteTableCommand({ TableName })).catch((e) => console.log(`cleanup: ${TableName}: ${e.message}`));
    if (bucket) {
      for (const o of await listObjects(bucket).catch(() => [])) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: o.Key })).catch(() => {});
      await s3.send(new DeleteBucketCommand({ Bucket: bucket })).catch((e) => console.log(`cleanup: bucket ${bucket}: ${e.message}`));
    }
  }

  if (problems.length) {
    console.log(`\n${problems.length} PROBLEMS`);
    for (const p of problems) console.log(`- ${p}`);
    process.exit(1);
  }
  console.log('\nrestore drill passed: every table and object restored identically, scratch resources deleted');
}

// ---- restore --------------------------------------------------------------------------------------
// Rows that make the Mailer Lambda (DynamoDB Streams) send an e-mail when they are inserted:
// a Notification never mailed, a participant whose invitation is neither sent nor skipped.
const mailProne = (model, item) => (model === 'Notification' && !item.emailed_at?.S)
  || (model === 'AppointmentParticipant' && !['sent', 'skipped'].includes(item.email_status?.S));
const retarget = (name, apiId) => name.split('-').map((part, i) => (i === 1 ? apiId : part)).join('-');

async function secretExists(name) {
  const client = new SecretsManagerClient({ region, endpoint: process.env.AWS_ENDPOINT_URL, credentials });
  return client.send(new DescribeSecretCommand({ SecretId: name })).then(() => true, () => false);
}

async function tableState(TableName) {
  try {
    const { Table } = await dynamo.send(new DescribeTableCommand({ TableName }));
    const page = await dynamo.send(new ScanCommand({ TableName, Limit: 1 }));
    return { exists: true, empty: (page.Items ?? []).length === 0, table: Table };
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return { exists: false, empty: true };
    throw err;
  }
}

async function restore(dir, apiId, flags) {
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  const prefix = flags.bucketPrefix ?? '';
  const problems = [];
  const plan = { tables: [], buckets: [] };

  for (const t of manifest.tables) {
    const target = retarget(t.name, apiId);
    const state = await tableState(target);
    const items = await readJsonl(join(dir, 'tables', `${t.name}.jsonl`));
    const model = t.name.split('-')[0];
    if (!state.exists && !flags.createTables) problems.push(`${target}: table does not exist (deploy the stack first, or pass --create-tables for a rehearsal)`);
    if (state.exists) {
      const sameKeys = JSON.stringify(state.table.KeySchema) === JSON.stringify(t.keySchema);
      const have = new Set((state.table.GlobalSecondaryIndexes ?? []).map((g) => g.IndexName));
      if (!sameKeys) problems.push(`${target}: key schema differs from the backup`);
      for (const g of t.gsis) if (!have.has(g.IndexName)) problems.push(`${target}: missing index ${g.IndexName}`);
      if (!state.empty && !flags.merge) problems.push(`${target}: not empty (pass --merge to write over it)`);
    }
    plan.tables.push({ source: t, target, items, mail: items.filter((i) => mailProne(model, i)).length, create: !state.exists });
  }

  for (const b of manifest.buckets) {
    const target = `${prefix}${b.name}`;
    const existing = new Map((await listObjects(target).catch(() => [])).map((o) => [o.Key, o.Size]));
    for (const o of b.objects) {
      if (!existing.has(o.key)) continue;
      const live = await getObject(target, o.key);
      if (sha256(live.body) !== o.sha256 && !flags.merge) problems.push(`${target}/${o.key}: exists with different content (pass --merge to overwrite)`);
    }
    plan.buckets.push({ source: b, target });
  }

  const mailRows = plan.tables.reduce((n, t) => n + t.mail, 0);
  const secretName = process.env.ERP_SECRET_NAME ?? 'erp-functions-config';
  if (mailRows > 0 && !flags.mailOk && (await secretExists(secretName))) {
    problems.push(`${mailRows} Notification / participant rows are not marked as mailed and secret "${secretName}" exists: the Mailer would send them. Restore BEFORE creating the secret, or pass --mail-ok`);
  }

  console.log(`restore ${dir}\n  from api ${manifest.apiId} to api ${apiId}${prefix ? `, bucket prefix "${prefix}"` : ''}`);
  for (const t of plan.tables) console.log(`  table  ${t.target.padEnd(52)} ${String(t.items.length).padStart(5)} items${t.create ? ' (will create)' : ''}`);
  for (const b of plan.buckets) console.log(`  bucket ${b.target.padEnd(52)} ${String(b.source.objects.length).padStart(5)} objects`);
  if (problems.length) {
    console.log(`\n${problems.length} PROBLEMS, nothing written`);
    for (const p of problems) console.log(`- ${p}`);
    process.exit(1);
  }
  if (!flags.yes) {
    console.log('\ndry run: nothing written. Re-run with --yes to apply.');
    return;
  }

  for (const t of plan.tables) {
    if (t.create) {
      await dynamo.send(new CreateTableCommand({
        TableName: t.target, KeySchema: t.source.keySchema, AttributeDefinitions: t.source.attributeDefinitions, BillingMode: 'PAY_PER_REQUEST',
        ...(t.source.gsis.length ? { GlobalSecondaryIndexes: t.source.gsis } : {}),
      }));
      await waitUntilTableExists({ client: dynamo, maxWaitTime: 60 }, { TableName: t.target });
    }
    await putBatch(t.target, t.items);
  }
  for (const b of plan.buckets) {
    await s3.send(new CreateBucketCommand({ Bucket: b.target })).catch((e) => { if (!/BucketAlready/.test(e.name)) throw e; });
    if (b.source.cors?.length) await s3.send(new PutBucketCorsCommand({ Bucket: b.target, CORSConfiguration: { CORSRules: b.source.cors } }));
    for (const o of b.source.objects) {
      const body = await readFile(join(dir, 's3', b.source.name, ...o.key.split('/')));
      if (sha256(body) !== o.sha256) problems.push(`${b.source.name}/${o.key}: backup file does not match its sha256, not restored`);
      else await s3.send(new PutObjectCommand({ Bucket: b.target, Key: o.key, Body: body, ContentType: o.contentType }));
    }
  }

  // Read everything back.
  for (const t of plan.tables) {
    const back = new Set(canonical(await scanAll(t.target)));
    const missing = canonical(t.items).filter((row) => !back.has(row));
    if (missing.length) problems.push(`${t.target}: ${missing.length} rows missing or different after the restore`);
    else console.log(`  verified ${t.target}: ${t.items.length} rows`);
  }
  for (const b of plan.buckets) {
    for (const o of b.source.objects) {
      const back = await getObject(b.target, o.key).catch(() => null);
      if (!back || sha256(back.body) !== o.sha256 || back.contentType !== o.contentType) problems.push(`${b.target}/${o.key}: differs after the restore`);
    }
    console.log(`  verified ${b.target}: ${b.source.objects.length} objects (sha256)`);
  }
  if (problems.length) {
    console.log(`\n${problems.length} PROBLEMS`);
    for (const p of problems) console.log(`- ${p}`);
    process.exit(1);
  }
  console.log('\nrestore complete and verified');
}

// ---- main -----------------------------------------------------------------------------------------
const argv = process.argv.slice(2);
const flags = {
  yes: argv.includes('--yes'), merge: argv.includes('--merge'), createTables: argv.includes('--create-tables'), mailOk: argv.includes('--mail-ok'),
  bucketPrefix: argv.includes('--bucket-prefix') ? argv[argv.indexOf('--bucket-prefix') + 1] : undefined,
};
const positional = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--bucket-prefix');
const [command, arg, extra] = positional;
if (command === 'backup' && arg) await backup(arg, extra);
else if (command === 'drill' && arg) await drill(arg);
else if (command === 'restore' && arg && extra) await restore(arg, extra, flags);
else {
  console.error([
    'usage: node scripts/backup.mjs backup  <apiId> [outDir]',
    '       node scripts/backup.mjs drill   <backupDir>',
    '       node scripts/backup.mjs restore <backupDir> <targetApiId> [--yes] [--merge] [--mail-ok] [--create-tables] [--bucket-prefix <p>]',
    '         restore is a dry run unless --yes; tables must already exist (deployed) and be empty unless --merge;',
    '         --create-tables and --bucket-prefix are for rehearsals on scratch names.',
  ].join('\n'));
  process.exit(1);
}
