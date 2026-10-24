#!/usr/bin/env node
// Does Floci keep its state across a restart? Tested on a SCRATCH Floci, never on the live one.
//   node scripts/persistence-check.mjs <floci-image> [hybrid,persistent]
// e.g. image = $(docker inspect floci-floci-1 --format '{{.Image}}') so the test runs the version in use.
//
// Each storage mode gets its own container (own network, own data volume, host port 14566), then:
//   1. graceful `docker restart`
//   2. hard `docker kill` 1 s after the last write
//   3. hard `docker kill` 8 s after the last write (past the 5 s flush interval)
// DynamoDB (+GSI), S3, Secrets Manager, CloudFormation and Lambda are written and re-read after each.
// AppSync is left out on purpose: its sidecar container has a fixed name that would clash with the live one.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CloudFormationClient, CreateStackCommand, DescribeStacksCommand, waitUntilStackCreateComplete } from '@aws-sdk/client-cloudformation';
import { CreateTableCommand, DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, waitUntilTableExists } from '@aws-sdk/client-dynamodb';
import { CreateFunctionCommand, InvokeCommand, LambdaClient, GetFunctionCommand } from '@aws-sdk/client-lambda';
import { CreateBucketCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { CreateSecretCommand, GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const image = process.argv[2];
const modes = (process.argv[3] ?? 'hybrid,persistent').split(',');
if (!image) {
  console.error('usage: node scripts/persistence-check.mjs <floci-image> [hybrid,persistent]');
  process.exit(1);
}

const PORT = 14566;
const NETWORK = 'floci_scratch_pc';
const ENDPOINT = `http://localhost:${PORT}`;
const cfg = { region: 'us-east-1', endpoint: ENDPOINT, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } };
const dynamo = new DynamoDBClient(cfg);
const s3 = new S3Client({ ...cfg, forcePathStyle: true });
const secrets = new SecretsManagerClient(cfg);
const cfn = new CloudFormationClient(cfg);
const lambda = new LambdaClient(cfg);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim();
const dockerQuiet = (...args) => spawnSync('docker', args, { encoding: 'utf8' });

function startContainer(mode) {
  const name = `floci-scratch-pc-${mode}`;
  dockerQuiet('rm', '-f', name);
  docker('volume', 'create', `scratch-pc-data-${mode}`);
  docker(
    'run', '-d', '--name', name, '--network', NETWORK, '-p', `${PORT}:4566`,
    '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', `scratch-pc-data-${mode}:/app/data`,
    '-e', `FLOCI_STORAGE_MODE=${mode}`, '-e', 'FLOCI_STORAGE_PERSISTENT_PATH=/app/data',
    '-e', 'FLOCI_HOSTNAME=floci-scratch-pc', '-e', 'FLOCI_BASE_URL=http://floci-scratch-pc:4566',
    '-e', `FLOCI_SERVICES_DOCKER_NETWORK=${NETWORK}`, '-e', 'FLOCI_SERVICES_LAMBDA_HOT_RELOAD_ENABLED=true',
    image,
  );
  return name;
}

async function waitUp() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const res = await fetch(`${ENDPOINT}/`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await sleep(1000);
  }
  throw new Error('scratch Floci did not come up');
}

function lambdaZip() {
  const dir = mkdtempSync(join(tmpdir(), 'pc-lambda-'));
  const zip = join(dir, 'fn.zip');
  const code = `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1],'w');z.writestr('index.js','exports.handler=async()=>({ok:true});');z.close()`;
  execFileSync('python', ['-c', code, zip]);
  return readFileSync(zip);
}

const TABLE = 'pc-table';
const template = JSON.stringify({
  Resources: { T: { Type: 'AWS::DynamoDB::Table', Properties: { TableName: 'pc-stack-table', BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }], KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }] } } },
});

async function seed(fnName) {
  await dynamo.send(new CreateTableCommand({
    TableName: TABLE, BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [{ AttributeName: 'pk', AttributeType: 'S' }, { AttributeName: 'gsi', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [{ IndexName: 'byGsi', KeySchema: [{ AttributeName: 'gsi', KeyType: 'HASH' }], Projection: { ProjectionType: 'ALL' } }],
  }));
  await waitUntilTableExists({ client: dynamo, maxWaitTime: 60 }, { TableName: TABLE });
  for (const pk of ['a', 'b', 'c']) await dynamo.send(new PutItemCommand({ TableName: TABLE, Item: { pk: { S: pk }, gsi: { S: 'g' }, note: { S: `seed-${pk}` } } }));
  await s3.send(new CreateBucketCommand({ Bucket: 'pc-bucket' }));
  await s3.send(new PutObjectCommand({ Bucket: 'pc-bucket', Key: 'seed.bin', Body: Buffer.from('seed-bytes-0123456789'), ContentType: 'application/x-test' }));
  await secrets.send(new CreateSecretCommand({ Name: 'pc-secret', SecretString: 'seed-secret' }));
  await cfn.send(new CreateStackCommand({ StackName: 'pc-stack', TemplateBody: template }));
  await waitUntilStackCreateComplete({ client: cfn, maxWaitTime: 90 }, { StackName: 'pc-stack' });
  await lambda.send(new CreateFunctionCommand({ FunctionName: fnName, Runtime: 'nodejs20.x', Handler: 'index.handler', Role: 'arn:aws:iam::000000000000:role/pc', Code: { ZipFile: lambdaZip() } }));
}

async function verify(fnName, extra) {
  const results = {};
  const attempt = async (label, fn) => { try { results[label] = Boolean(await fn()); } catch { results[label] = false; } };
  await attempt('dynamodb seed items + GSI', async () => {
    const res = await dynamo.send(new QueryCommand({ TableName: TABLE, IndexName: 'byGsi', KeyConditionExpression: 'gsi = :g', ExpressionAttributeValues: { ':g': { S: 'g' } } }));
    return (res.Items ?? []).filter((i) => ['a', 'b', 'c'].includes(i.pk.S)).length === 3;
  });
  await attempt('s3 seed object', async () => {
    const res = await s3.send(new GetObjectCommand({ Bucket: 'pc-bucket', Key: 'seed.bin' }));
    return Buffer.from(await res.Body.transformToByteArray()).toString() === 'seed-bytes-0123456789' && res.ContentType === 'application/x-test';
  });
  await attempt('secrets manager', async () => (await secrets.send(new GetSecretValueCommand({ SecretId: 'pc-secret' }))).SecretString === 'seed-secret');
  await attempt('cloudformation stack', async () => (await cfn.send(new DescribeStacksCommand({ StackName: 'pc-stack' }))).Stacks[0].StackStatus === 'CREATE_COMPLETE');
  await attempt('lambda definition', async () => (await lambda.send(new GetFunctionCommand({ FunctionName: fnName }))).Configuration.FunctionName === fnName);
  await attempt('lambda invoke', async () => JSON.parse(Buffer.from((await lambda.send(new InvokeCommand({ FunctionName: fnName }))).Payload).toString()).ok === true);
  if (extra) {
    await attempt(`dynamodb ${extra.pk}`, async () => (await dynamo.send(new GetItemCommand({ TableName: TABLE, Key: { pk: { S: extra.pk } } }))).Item?.note?.S === extra.pk);
    await attempt(`s3 ${extra.pk}`, async () => (await s3.send(new GetObjectCommand({ Bucket: 'pc-bucket', Key: extra.pk }))).ContentLength > 0);
  }
  return results;
}

async function writeMarker(pk) {
  await dynamo.send(new PutItemCommand({ TableName: TABLE, Item: { pk: { S: pk }, gsi: { S: 'g' }, note: { S: pk } } }));
  await s3.send(new PutObjectCommand({ Bucket: 'pc-bucket', Key: pk, Body: Buffer.from(pk) }));
}

const report = [];
function record(mode, scenario, results) {
  const bad = Object.entries(results).filter(([, ok]) => !ok).map(([k]) => k);
  report.push({ mode, scenario, bad });
  console.log(`${mode.padEnd(11)} ${scenario.padEnd(28)} ${bad.length ? `LOST: ${bad.join(', ')}` : 'everything survived'}`);
}

async function run(mode) {
  const fnName = `pcscratch${mode}`;
  const name = startContainer(mode);
  await waitUp();
  await seed(fnName);
  record(mode, 'before any restart (control)', await verify(fnName));

  docker('restart', '-t', '30', name);
  await waitUp();
  record(mode, 'graceful restart', await verify(fnName));

  await writeMarker('soon');
  await sleep(1000);
  docker('kill', name);
  docker('start', name);
  await waitUp();
  record(mode, 'hard kill 1 s after write', await verify(fnName, { pk: 'soon' }));

  await writeMarker('late');
  await sleep(8000);
  docker('kill', name);
  docker('start', name);
  await waitUp();
  record(mode, 'hard kill 8 s after write', await verify(fnName, { pk: 'late' }));
}

try {
  dockerQuiet('network', 'create', NETWORK);
  for (const mode of modes) {
    try { await run(mode); } catch (err) { console.log(`${mode}: check aborted: ${err.message}`); report.push({ mode, scenario: 'aborted', bad: [err.message] }); }
    finally {
      // Lambda containers started by the scratch Floci live on the scratch network; remove them with it.
      dockerQuiet('rm', '-f', `floci-scratch-pc-${mode}`);
      const stray = dockerQuiet('ps', '-aq', '--filter', `network=${NETWORK}`).stdout.split('\n').filter(Boolean);
      if (stray.length) dockerQuiet('rm', '-f', ...stray);
      dockerQuiet('volume', 'rm', '-f', `scratch-pc-data-${mode}`);
    }
  }
} finally {
  dockerQuiet('network', 'rm', NETWORK);
}
process.exit(report.some((r) => r.bad.length && !/hard kill 1 s/.test(r.scenario)) ? 1 : 0);
