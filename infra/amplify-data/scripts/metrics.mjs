#!/usr/bin/env node
// Inventory / metrics harvest for the ERP data layer deployed on the local AWS
// emulator (Floci). Everything is measured through the AWS APIs themselves:
//   node scripts/metrics.mjs
// Optional env: AWS_ENDPOINT_URL (default http://localhost:4566), AWS_REGION, METRICS_OUT (default metrics/)
// Writes metrics/<date>-inventory.json and a human-readable Markdown summary next to it.
// Read-only: List/Describe/Scan(Select=COUNT) calls only; nothing is mutated.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { CloudFormationClient, ListStacksCommand, DescribeStacksCommand, ListStackResourcesCommand } from '@aws-sdk/client-cloudformation';
import { DynamoDBClient, ListTablesCommand, ScanCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { S3Client, ListBucketsCommand, ListObjectsV2Command, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import { AppSyncClient, ListGraphqlApisCommand, GetGraphqlApiCommand, ListResolversCommand, ListApiKeysCommand, ListFunctionsCommand as ListAppSyncFunctionsCommand } from '@aws-sdk/client-appsync';
import { SecretsManagerClient, ListSecretsCommand } from '@aws-sdk/client-secrets-manager';
import { CloudWatchLogsClient, DescribeLogGroupsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { IAMClient, ListRolesCommand } from '@aws-sdk/client-iam';

const endpoint = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
const region = process.env.AWS_REGION ?? 'us-east-1';
const outDir = process.env.METRICS_OUT ?? 'metrics';
const cfg = {
  region,
  endpoint,
  credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? 'test', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? 'test' },
};
const dynamo = new DynamoDBClient(cfg);
const s3 = new S3Client({ ...cfg, forcePathStyle: true });
const lambda = new LambdaClient(cfg);
const cfn = new CloudFormationClient(cfg);
const appsync = new AppSyncClient(cfg);
const secrets = new SecretsManagerClient(cfg);
const logs = new CloudWatchLogsClient(cfg);
const iam = new IAMClient(cfg);

const started = Date.now();

// --- helpers ----------------------------------------------------------------
async function allPages(pageFn, key, everPagination) {
  const out = [];
  let token;
  do {
    const res = await pageFn(token);
    out.push(...(res[key] ?? []));
    token = res.NextToken ?? res.nextToken ?? res.nextMarker;
  } while (token && everPagination);
  return out;
}

// Single-shot call (floci may or may not paginate); each section is isolated so
// one unsupported operation cannot kill the harvest.
async function section(name, fn) {
  const t0 = Date.now();
  try {
    const data = await fn();
    console.log(`  ✔ ${name} (${Date.now() - t0} ms)`);
    return data;
  } catch (err) {
    console.log(`  ✖ ${name}: ${err.name ?? err.message}`);
    return { error: String(err.message ?? err) };
  }
}

// --- CloudFormation: deployed stacks and their resource fan-out --------------
const stacks = await section('CloudFormation stacks', async () => {
  const summaries = await allPages(
    (token) => cfn.send(new ListStacksCommand({ NextToken: token })),
    'StackSummaries',
    true,
  );
  const live = summaries.filter((s) => !['REVIEW_IN_PROGRESS', 'DELETE_COMPLETE', 'DELETE_IN_PROGRESS', 'DELETE_FAILED'].includes(s.StackStatus));
  const detailed = [];
  for (const s of live) {
    const [full, resources] = await Promise.all([
      cfn.send(new DescribeStacksCommand({ StackName: s.StackName })),
      allPages((token) => cfn.send(new ListStackResourcesCommand({ StackName: s.StackName, NextToken: token })), 'StackResourceSummaries', true),
    ]);
    detailed.push({
      name: s.StackName,
      status: s.StackStatus,
      createdAt: s.CreationTime,
      resources: resources.length,
      byType: resources.reduce((acc, r) => ({ ...acc, [r.ResourceType]: (acc[r.ResourceType] ?? 0) + 1 }), {}),
    });
  }
  return detailed;
});

// --- DynamoDB: tables, capacity model, item counts, physical size -----------
const ddbTables = await section('DynamoDB tables', async () => {
  const names = await allPages((token) => dynamo.send(new ListTablesCommand({ NextToken: token })), 'TableNames', true);
  const tables = [];
  for (const name of names) {
    const d = await dynamo.send(new DescribeTableCommand({ TableName: name }));
    const count = await dynamo.send(new ScanCommand({ TableName: name, Select: 'COUNT' }));
    tables.push({
      name,
      items: count.Count,
      gsis: (d.Table.GlobalSecondaryIndexes ?? []).length,
      streams: d.Table.StreamSpecification?.StreamEnabled ?? false,
      billing: d.Table.BillingModeSummary?.BillingMode ?? 'PROVISIONED',
      bytes: d.Table.TableSizeBytes ?? null,
      arn: d.Table.TableArn,
    });
  }
  const items = tables.reduce((a, t) => a + t.items, 0);
  return { count: tables.length, totalItems: items, tables: tables.sort((a, b) => b.items - a.items) };
});

// --- Lambda ------------------------------------------------------------------
const functions = await section('Lambda functions', async () => {
  const fns = await allPages((token) => lambda.send(new ListFunctionsCommand({ NextToken: token })), 'Functions', true);
  return {
    count: fns.length,
    functions: fns.map((f) => ({
      name: f.FunctionName,
      runtime: f.Runtime,
      memory: f.MemorySize,
      timeout: f.Timeout,
      codeSize: f.CodeSize,
      description: f.Description,
    })),
  };
});

// --- AppSync ------------------------------------------------------------------
const appsyncApis = await section('AppSync GraphQL APIs', async () => {
  const apis = await allPages((token) => appsync.send(new ListGraphqlApisCommand({ NextToken: token })), 'graphqlApis', true);
  if (!apis.length) return [];
  const { ListTypesCommand } = await import('@aws-sdk/client-appsync');
  const out = [];
  for (const api of apis) {
    const [full, types, pipelineFns, keys] = await Promise.all([
      appsync.send(new GetGraphqlApiCommand({ apiId: api.apiId })),
      allPages((token) => appsync.send(new ListTypesCommand({ apiId: api.apiId, format: 'SDL', NextToken: token })), 'types', true),
      appsync.send(new ListAppSyncFunctionsCommand({ apiId: api.apiId })).catch(() => ({ functions: [] })),
      appsync.send(new ListApiKeysCommand({ apiId: api.apiId })).catch(() => ({ apiKeys: [] })),
    ]);
    let resolvers = 0;
    for (const t of types) {
      const r = await allPages(
        (token) => appsync.send(new ListResolversCommand({ apiId: api.apiId, typeName: t.name, NextToken: token })),
        'resolvers',
        true,
      );
      resolvers += r.length;
    }
    out.push({
      name: api.name,
      apiId: api.apiId,
      auth: full.graphqlApi.authenticationType,
      typeCount: types.length,
      resolverCount: resolvers,
      pipelineFunctionCount: (pipelineFns.functions ?? []).length,
      apiKeyCount: (keys.apiKeys ?? []).length,
      uris: full.graphqlApi.uris?.GraphQL ?? null,
    });
  }
  return out;
});

// --- S3 ----------------------------------------------------------------------
const buckets = await section('S3 buckets', async () => {
  const list = await s3.send(new ListBucketsCommand({}));
  const out = [];
  for (const b of list.Buckets ?? []) {
    let objects = 0;
    let bytes = 0;
    let token;
    let key;
    try {
      const loc = await s3.send(new GetBucketLocationCommand({ Bucket: b.Name }));
      do {
        const res = await s3.send(new ListObjectsV2Command({ Bucket: b.Name, ContinuationToken: token }));
        objects += res.KeyCount ?? (res.Contents?.length ?? 0);
        bytes += (res.Contents ?? []).reduce((a, o) => a + (o.Size ?? 0), 0);
        token = res.IsTruncated ? res.NextContinuationToken : undefined;
        key = b.Name;
      } while (token);
    } catch (e) {
      key = undefined;
      objects = -1;
      bytes = -1;
    }
    out.push({ name: b.Name, objects, bytes });
  }
  return out;
});

// --- Secrets Manager -----------------------------------------------------------
const secretsList = await section('Secrets Manager', async () => {
  const list = await allPages((token) => secrets.send(new ListSecretsCommand({ NextToken: token })), 'SecretList', true);
  return { count: list.length, secrets: list.map((s) => ({ name: s.Name, description: s.Description ?? null })) };
});

// --- CloudWatch Logs (native monitoring plane) ---------------------------------
const logGroups = await section('CloudWatch log groups', async () => {
  const groups = await allPages((token) => logs.send(new DescribeLogGroupsCommand({ NextToken: token })), 'logGroups', true);
  return {
    count: groups.length,
    groups: groups.map((g) => ({
      name: g.logGroupName,
      storedBytes: g.storedBytes ?? 0,
      retention: g.retentionInDays ?? null,
    })),
  };
});

// --- IAM ------------------------------------------------------------------------
const roles = await section('IAM roles', async () => {
  const list = await allPages((token) => iam.send(new ListRolesCommand({ NextToken: token })), 'Roles', true);
  return { count: list.length, roles: list.map((r) => ({ name: r.RoleName, path: r.Path })) };
});

// --- report --------------------------------------------------------------------
const okSections = (s) => (Array.isArray(s) ? s : s.tables !== undefined || s.functions !== undefined || s.groups !== undefined || s.roles !== undefined || s.secrets !== undefined ? s : []);
const appsyncList = Array.isArray(appsyncApis) ? appsyncApis : [];
const report = {
  meta: {
    collectedAt: new Date().toISOString(),
    endpoint,
    region,
    durationMs: Date.now() - started,
    source: 'AWS SDK v3 against AWS-API-compatible local emulator (Floci)',
  },
  cloudformation: stacks,
  dynamodb: ddbTables,
  lambda: functions,
  appsync: appsyncApis,
  s3: buckets,
  secrets: secretsList,
  cloudwatchLogs: logGroups,
  iam: roles,
};

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const jsonPath = join(outDir, `${stamp}-inventory.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2));

// Markdown summary for the CV work
const lines = [];
lines.push(`# ERP data layer — AWS resource inventory`);
lines.push('');
lines.push(`_Collected ${report.meta.collectedAt} via AWS SDK against \`${endpoint}\` (${region}) in ${((report.meta.durationMs) / 1000).toFixed(1)} s._`);
lines.push('');
for (const st of stacks) {
  lines.push(`## CloudFormation stack: \`${st.name}\` — ${st.status}`);
  lines.push(`- ${st.resources} AWS resources`);
  for (const [type, n] of Object.entries(st.byType).sort((a, b) => b[1] - a[1])) lines.push(`  - ${n} × ${type}`);
}
lines.push('');
lines.push(`## DynamoDB — ${ddbTables.count} tables, ${ddbTables.totalItems} items total`);
if (ddbTables.tables) {
  lines.push('');
  lines.push('| Table | Items | GSIs | Stream |');
  lines.push('|---|---:|---:|---|');
  for (const t of ddbTables.tables) lines.push(`| \`${t.name}\` | ${t.items} | ${t.gsis} | ${t.streams ? 'yes' : 'no'} |`);
}
lines.push('');
lines.push(`## Lambda — ${functions.count} functions`);
for (const f of functions.functions ?? []) lines.push(`- \`${f.name}\` ${f.runtime} ${f.memory} MB, timeout ${f.timeout} s`);
lines.push('');
for (const a of appsyncList) {
  lines.push(`## AppSync API: \`${a.name}\` (${a.apiId}), auth=${a.auth}`);
  lines.push(`- ${a.resolverCount} resolvers, ${a.pipelineFunctionCount} pipeline functions, ${a.apiKeyCount} API keys`);
}
if (!appsyncList.length) lines.push(`## AppSync API — list failed (${appsyncApis.error ?? 'no APIs found'})`);
lines.push('');
lines.push(`## S3 — ${buckets.length} buckets`);
for (const b of buckets) lines.push(`- \`${b.name}\`: ${b.objects} objects (${(b.bytes / 1024).toFixed(1)} KiB)`);
lines.push('');
lines.push(`## Secrets Manager — ${secretsList.count} secrets`);
for (const s of secretsList.secrets ?? []) lines.push(`- \`${s.name}\``);
lines.push('');
lines.push(`## CloudWatch Logs — ${logGroups.count} log groups`);
for (const g of logGroups.groups ?? []) lines.push(`- \`${g.name}\` (${g.storedBytes} B stored)`);
lines.push('');
lines.push(`## IAM — ${roles.count} roles`);
for (const r of roles.roles ?? []) lines.push(`- \`${r.name}\``);

const mdPath = join(outDir, `${stamp}-inventory.md`);
writeFileSync(mdPath, lines.join('\n') + '\n');

console.log('');
console.log(`Inventory complete → ${jsonPath} and ${mdPath}`);
console.log(`Stacks: ${stacks.length} | Tables: ${ddbTables.count} (${ddbTables.totalItems} items) | Lambdas: ${functions.count} | APIs: ${appsyncList.length} | Buckets: ${buckets.length} | Secrets: ${secretsList.count}`);
