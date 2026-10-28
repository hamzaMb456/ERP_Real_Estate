#!/usr/bin/env node
// Timed redeploy of the main stack, measured where a DevOps CV claim comes from:
//   1. `npx cdk synth` wall time (per-target synth)
//   2. full idempotent `node scripts/deploy.mjs main --yes` wall time
// Both ends up in CloudWatch Metrics (namespace ERP/Deploy), read back through
// GetMetricStatistics — so the "deployment time" number lives in the AWS monitoring plane.
//   node scripts/deploy-timed.mjs
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CloudWatchClient, PutMetricDataCommand, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';

process.env.AWS_ENDPOINT_URL ??= 'http://localhost:4566';
process.env.AWS_REGION ??= 'us-east-1';
process.env.AWS_ACCESS_KEY_ID ??= 'test';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test';

const cw = new CloudWatchClient({});
const NAMESPACE = 'ERP/Deploy';
const started = Date.now();

function run(cmd, args) {
  const t0 = Date.now();
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  const seconds = +(Date.now() - t0) / 1000;
  if (res.status !== 0) throw new Error(`${cmd} failed (${res.status})`);
  return seconds;
}

// 1. synth to a throw-away out dir (does not disturb .amplify/artifacts)
const tmp = mkdtempSync(join(tmpdir(), 'cdk-synth-metrics-'));
let synthSec;
try {
  synthSec = run('npx', ['cdk synth', '--quiet', '-o', `"${tmp}"`, '--app', '"npx tsx amplify/backend.ts"', '-c', 'amplify-backend-namespace=erp', '-c', 'amplify-backend-name=main', '-c', 'amplify-backend-type=sandbox']);
  console.log(`cdk synth: ${synthSec.toFixed(1)} s`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// 2. idempotent redeploy of main (the pipeline the developers actually run)
console.log('redeploying main stack (idempotent)...');
const deploySec = run('node', ['scripts/deploy.mjs', 'main', '--yes']);
console.log(`deploy main: ${deploySec.toFixed(1)} s`);

// 3. publish through PutMetricData, read back through GetMetricStatistics
const stamp = Math.floor(Date.now() / 1000);
await cw.send(new PutMetricDataCommand({
  Namespace: NAMESPACE,
  MetricData: [
    { MetricName: 'CdkSynthDuration', Unit: 'Seconds', Value: synthSec, Timestamp: new Date(stamp * 1000) },
    { MetricName: 'RedeployDuration', Unit: 'Seconds', Value: deploySec, Timestamp: new Date(stamp * 1000) },
    { MetricName: 'RedeployCount', Unit: 'Count', Value: 1, Timestamp: new Date(stamp * 1000) },
  ],
}));

const readback = {};
for (const name of ['CdkSynthDuration', 'RedeployDuration', 'RedeployCount']) {
  const r = await cw.send(new GetMetricStatisticsCommand({
    Namespace: NAMESPACE,
    MetricName: name,
    StartTime: new Date(stamp * 1000 - 60_000),
    EndTime: new Date(stamp * 1000 + 60_000),
    Period: 60,
    Statistics: ['Sum', 'Maximum', 'SampleCount'],
  }));
  const d = r.Datapoints?.[0];
  readback[name] = d ? { sum: d.Sum, max: d.Maximum, samples: d.SampleCount, unit: d.Unit } : null;
}
console.log('CloudWatch read-back:', JSON.stringify(readback, null, 2));

mkdirSync('metrics', { recursive: true });
const out = {
  collectedAt: new Date().toISOString(),
  durationMs: Date.now() - started,
  cdkSynthSeconds: synthSec,
  redeploySeconds: deploySec,
  cloudwatch: { namespace: NAMESPACE, readback },
};
writeFileSync('metrics/2026-10-27-deploy.json', JSON.stringify(out, null, 2));
writeFileSync('metrics/2026-10-27-deploy.md',
  `# Timed deploy (main stack)\n\n_Collected ${out.collectedAt}; durations also live in CloudWatch Metrics namespace \`${NAMESPACE}\` (read back via GetMetricStatistics)._\n\n- \`cdk synth\`: **${synthSec.toFixed(1)} s**\n- idempotent \`deploy main\` (synth + patches + cdk deploy, 23 stacks): **${deploySec.toFixed(1)} s**\n- CloudWatch sample count check: ${readback.RedeployCount?.samples ?? 'n/a'}\n`);
console.log(`done (${((Date.now() - started) / 1000).toFixed(1)} s total) → metrics/2026-10-27-deploy.{json,md}`);
