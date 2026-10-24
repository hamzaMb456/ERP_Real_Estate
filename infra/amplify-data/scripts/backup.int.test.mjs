// Integration test for `scripts/backup.mjs restore` against Floci, on scratch names only:
// fake api ids, a bucket prefix and scratch secret names. Skips when Floci is not reachable.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  CreateTableCommand, DeleteTableCommand, DynamoDBClient, QueryCommand, ScanCommand, waitUntilTableExists,
} from '@aws-sdk/client-dynamodb';
import { DeleteBucketCommand, DeleteObjectCommand, GetBucketCorsCommand, GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { CreateSecretCommand, DeleteSecretCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const ENDPOINT = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
const cfg = { region: 'us-east-1', endpoint: ENDPOINT, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } };
const dynamo = new DynamoDBClient(cfg);
const s3 = new S3Client({ ...cfg, forcePathStyle: true });
const secrets = new SecretsManagerClient(cfg);
const hex = () => randomBytes(3).toString('hex');
const sha = (text) => createHash('sha256').update(text).digest('hex');
const SCRIPT = fileURLToPath(new URL('./backup.mjs', import.meta.url));

const up = await fetch(`${ENDPOINT}/`).then((r) => r.ok, () => false);
const OLD = `old${hex()}`;
const prefix = `drill${hex()}-`;
const secretName = `drill-secret-${hex()}`;
// The real secret (erp-functions-config) exists on the live Floci: tests must never see it.
const NO_SECRET = `drill-nosecret-${hex()}`;
const apis = [];
const buckets = new Set();
let dir;

const BODY = 'hello restore';
const CORS = [{ AllowedOrigins: ['http://localhost:3000'], AllowedMethods: ['GET'], AllowedHeaders: ['*'], MaxAgeSeconds: 3000 }];
const gsiTable = (name) => ({
  name,
  keySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
  attributeDefinitions: [{ AttributeName: 'pk', AttributeType: 'S' }, { AttributeName: 'grp', AttributeType: 'S' }],
  gsis: [{ IndexName: 'byGrp', KeySchema: [{ AttributeName: 'grp', KeyType: 'HASH' }], Projection: { ProjectionType: 'ALL' } }],
});

async function makeTables(apiId, models = ['Thing', 'Notification']) {
  apis.push(apiId);
  for (const model of models) {
    const t = gsiTable(`${model}-${apiId}-NONE`);
    await dynamo.send(new CreateTableCommand({
      TableName: t.name, KeySchema: t.keySchema, AttributeDefinitions: t.attributeDefinitions, BillingMode: 'PAY_PER_REQUEST', GlobalSecondaryIndexes: t.gsis,
    }));
    await waitUntilTableExists({ client: dynamo, maxWaitTime: 60 }, { TableName: t.name });
  }
}

const run = (args, env = {}) => spawnSync('node', [SCRIPT, 'restore', dir, ...args], {
  encoding: 'utf8', env: { ...process.env, ERP_SECRET_NAME: NO_SECRET, ...env },
});
const count = async (TableName) => (await dynamo.send(new ScanCommand({ TableName }))).Items.length;

before(async () => {
  if (!up) return;
  dir = await mkdtemp(join(tmpdir(), 'backup-test-'));
  await mkdir(join(dir, 'tables'), { recursive: true });
  await mkdir(join(dir, 's3', 'property-files', 'p'), { recursive: true });
  const things = [{ pk: { S: 't1' }, grp: { S: 'g' }, n: { N: '1' } }, { pk: { S: 't2' }, grp: { S: 'g' }, n: { N: '2' } }];
  const notifications = [{ pk: { S: 'n1' }, grp: { S: 'u' }, emailed_at: { NULL: true } }];
  await writeFile(join(dir, 'tables', `Thing-${OLD}-NONE.jsonl`), things.map((i) => JSON.stringify(i)).join('\n'));
  await writeFile(join(dir, 'tables', `Notification-${OLD}-NONE.jsonl`), notifications.map((i) => JSON.stringify(i)).join('\n'));
  await writeFile(join(dir, 's3', 'property-files', 'p', 'a.txt'), BODY);
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({
    createdAt: new Date().toISOString(), apiId: OLD,
    tables: [{ ...gsiTable(`Thing-${OLD}-NONE`), count: 2 }, { ...gsiTable(`Notification-${OLD}-NONE`), count: 1 }],
    buckets: [{
      name: 'property-files', cors: CORS,
      objects: [{ key: 'p/a.txt', size: BODY.length, sha256: sha(BODY), contentType: 'text/plain' }],
    }],
  }));
});

after(async () => {
  if (!up) return;
  for (const apiId of apis) for (const model of ['Thing', 'Notification']) await dynamo.send(new DeleteTableCommand({ TableName: `${model}-${apiId}-NONE` })).catch(() => {});
  for (const Bucket of [`${prefix}property-files`, ...buckets]) {
    const page = await s3.send(new ListObjectsV2Command({ Bucket })).catch(() => ({ Contents: [] }));
    for (const o of page.Contents ?? []) await s3.send(new DeleteObjectCommand({ Bucket, Key: o.Key }));
    await s3.send(new DeleteBucketCommand({ Bucket })).catch(() => {});
  }
  await secrets.send(new DeleteSecretCommand({ SecretId: secretName, ForceDeleteWithoutRecovery: true })).catch(() => {});
  await rm(dir, { recursive: true, force: true });
});

test('restore: dry run writes nothing, --yes restores tables and objects, then refuses a non-empty target', { skip: !up }, async () => {
  const api = `new${hex()}`;
  await makeTables(api);
  const dry = run([api, '--bucket-prefix', prefix]);
  assert.equal(dry.status, 0, dry.stdout + dry.stderr);
  assert.match(dry.stdout, /dry run/);
  assert.equal(await count(`Thing-${api}-NONE`), 0);

  const apply = run([api, '--bucket-prefix', prefix, '--yes']);
  assert.equal(apply.status, 0, apply.stdout + apply.stderr);
  assert.match(apply.stdout, /restore complete and verified/);
  assert.equal(await count(`Thing-${api}-NONE`), 2);
  const viaIndex = await dynamo.send(new QueryCommand({ TableName: `Thing-${api}-NONE`, IndexName: 'byGrp', KeyConditionExpression: 'grp = :g', ExpressionAttributeValues: { ':g': { S: 'g' } } }));
  assert.equal(viaIndex.Items.length, 2);
  const object = await s3.send(new GetObjectCommand({ Bucket: `${prefix}property-files`, Key: 'p/a.txt' }));
  assert.equal(await object.Body.transformToString(), BODY);
  assert.equal(object.ContentType, 'text/plain');
  const cors = await s3.send(new GetBucketCorsCommand({ Bucket: `${prefix}property-files` }));
  assert.deepEqual(cors.CORSRules.map((r) => r.AllowedOrigins), [['http://localhost:3000']]);
  // The prefix keeps the rehearsal away from the real bucket.
  await assert.rejects(s3.send(new GetObjectCommand({ Bucket: 'property-files', Key: 'p/a.txt' })));

  const again = run([api, '--bucket-prefix', prefix, '--yes']);
  assert.equal(again.status, 1);
  assert.match(again.stdout, /not empty/);
  assert.equal(run([api, '--bucket-prefix', prefix, '--yes', '--merge']).status, 0);
});

test('restore: a missing table is refused unless --create-tables', { skip: !up }, async () => {
  const api = `new${hex()}`;
  apis.push(api);
  const refused = run([api, '--bucket-prefix', prefix, '--yes']);
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /does not exist/);
  const created = run([api, '--bucket-prefix', prefix, '--yes', '--create-tables']);
  assert.equal(created.status, 0, created.stdout + created.stderr);
  assert.equal(await count(`Thing-${api}-NONE`), 2);
});

test('restore: rows the Mailer would send are refused while the SMTP secret exists', { skip: !up }, async () => {
  await secrets.send(new CreateSecretCommand({ Name: secretName, SecretString: '{}' }));
  const api = `new${hex()}`;
  await makeTables(api);
  const env = { ERP_SECRET_NAME: secretName };
  const refused = run([api, '--bucket-prefix', prefix, '--yes'], env);
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /Mailer would send/);
  assert.equal(await count(`Notification-${api}-NONE`), 0);
  const allowed = run([api, '--bucket-prefix', prefix, '--yes', '--mail-ok'], env);
  assert.equal(allowed.status, 0, allowed.stdout + allowed.stderr);
  assert.equal(await count(`Notification-${api}-NONE`), 1);
});

test('restore: a backup file that no longer matches its sha256 is not written to S3', { skip: !up }, async () => {
  await writeFile(join(dir, 's3', 'property-files', 'p', 'a.txt'), 'tampered');
  const api = `new${hex()}`;
  await makeTables(api);
  const otherPrefix = `drill${hex()}-`;
  buckets.add(`${otherPrefix}property-files`);
  const result = run([api, '--bucket-prefix', otherPrefix, '--yes']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /does not match its sha256/);
  await writeFile(join(dir, 's3', 'property-files', 'p', 'a.txt'), BODY);
});
