#!/usr/bin/env node
// GraphQL AppSync load test, read-only (PublicLatestListings), the same request shape
// the public site sends. Latency is PUSHED to CloudWatch Metrics (namespace ERP/AppSync)
// via PutMetricData and read back via GetMetricStatistics — the numbers live in the AWS
// monitoring plane, not just in this console log.
//   node scripts/load-test.mjs [seconds=20] [concurrency=16]
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

const SECONDS = Number(process.argv[2] ?? 20);
const CONC = Number(process.argv[3] ?? 16);

// endpoint + http public token read from the web app env
const env = readFileSync(join('..', '..', 'web', '.env.local'), 'utf8');
const endpoint = /^APPSYNC_URL=(.*)$/m.exec(env)?.[1]?.trim() ?? 'http://localhost:4566/v1/apis/861df1f5118d47acb3576c3db2/graphql';
let orgId = /^NEXT_PUBLIC_AGENCY_ORG_ID=(.*)$/m.exec(env)?.[1]?.trim() ?? '';

const cw = new CloudWatchClient({ region: 'us-east-1', endpoint: 'http://localhost:4566', credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
const NAMESPACE = 'ERP/AppSync';

// positive-control first (read-only, mirrors validate-access.mjs httpChecks)
const QUERY = 'query Run($op: String!, $v: AWSJSON) { run(op: $op, variables: $v) }';
async function call() {
  const body = JSON.stringify({
    query: QUERY,
    variables: { op: 'PublicLatestListings', v: JSON.stringify({ where: { _and: [{ organization_id: { _eq: orgId } }] }, orderBy: [{ published_at: 'desc_nulls_last' }], limit: 20 }) },
  });
  const t0 = performance.now();
  const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'public' }, body });
  const json = await res.json().catch(() => null);
  const ms = performance.now() - t0;
  const ok = res.status === 200 && JSON.parse(json?.data?.run ?? '{}')?.listings?.length > 0;
  return { ms, status: res.status, ok, hasData: Boolean(json?.data?.run) };
}

orgId ||= '11111111-1111-4111-8111-111111111111';
const probe = await call();
if (!probe.ok) {
  console.error('positive control failed:', probe.status, JSON.stringify(probe));
  process.exit(1);
}
console.log(`positive control ok (${probe.ms.toFixed(0)} ms)`);

// load loop
const lat = [];
let errors = 0;
let ok200 = 0;
const deadline = performance.now() + SECONDS * 1000;
const worker = async () => {
  while (performance.now() < deadline) {
    const r = await call();
    if (r.ok) ok200 += 1;
    if (!r.ok) errors += 1;
    lat.push(r.ms);
  }
};
const t0 = performance.now();
await Promise.all(Array.from({ length: CONC }, worker));
const wall = (performance.now() - t0) / 1000;
lat.sort((a, b) => a - b);
const pick = (p) => lat[Math.min(lat.length - 1, Math.floor(lat.length * p))];
const mean = lat.reduce((a, b) => a + b, 0) / lat.length;
const summary = {
  endpoint,
  op: 'PublicLatestListings',
  seconds: SECONDS,
  concurrency: CONC,
  requests: lat.length,
  ok200,
  errors,
  rps: +(lat.length / wall).toFixed(1),
  ms: { mean: +mean.toFixed(1), p50: +pick(0.5).toFixed(1), p90: +pick(0.9).toFixed(1), p95: +pick(0.95).toFixed(1), p99: +pick(0.99).toFixed(1), max: +lat[lat.length - 1].toFixed(1), min: +lat[0].toFixed(1) },
};

// publish to CloudWatch then read back
const now = new Date();
await cw.send(new PutMetricDataCommand({
  Namespace: NAMESPACE,
  MetricData: [
    { MetricName: 'RequestLatency', Unit: 'Milliseconds', Statistics: { Minimum: summary.ms.min, Maximum: summary.ms.max, SampleCount: lat.length, Sum: lat.reduce((a, b) => a + b, 0) }, Timestamp: now },
    { MetricName: 'LatencyP95', Unit: 'Milliseconds', Value: summary.ms.p95, Timestamp: now },
    { MetricName: 'RequestsPerSecond', Unit: 'Count/Second', Value: summary.rps, Timestamp: now },
  ],
}));
const readback = {};
for (const name of ['RequestLatency', 'LatencyP95', 'RequestsPerSecond']) {
  const r = await cw.send(new GetMetricStatisticsCommand({
    Namespace: NAMESPACE, MetricName: name,
    StartTime: new Date(now.getTime() - 60_000), EndTime: new Date(now.getTime() + 60_000),
    Period: 60, Statistics: ['Sum', 'Maximum', 'SampleCount'],
  }));
  readback[name] = r.Datapoints?.[0] ?? null;
}
summary.cloudwatch = { namespace: NAMESPACE, readback };

mkdirSync('metrics', { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
writeFileSync(`metrics/${stamp}-load.json`, JSON.stringify(summary, null, 2));
writeFileSync(`metrics/${stamp}-load.md`,
`# AppSync load test (read-only: PublicLatestListings)\n\n_Collected ${new Date().toISOString()} — quantiles also live in CloudWatch Metrics \`${NAMESPACE}\` (Push+Get via CloudWatch API)._\n\n- ${summary.requests} requests in ${SECONDS} s at concurrency ${summary.conc ?? CONC}: **${summary.rps} req/s**, ${summary.errors} failures\n- latency ms: p50 ${summary.ms.p50} / p90 ${summary.ms.p90} / p95 **${summary.ms.p95}** / p99 ${summary.ms.p99} / max ${summary.ms.max}\n- CloudWatch sample count: ${summary.cloudwatch.readback.RequestLatency?.sampleCount ?? 'n/a'}\n`);
console.log(JSON.stringify(summary, null, 2));
