#!/usr/bin/env node
// CloudWatch Logs audit of the deployed ERP backend: what the backend actually
// logged, when, and which errors occurred. Pure AWS monitoring plane.
//   node scripts/logs-metrics.mjs
// Optional env: AWS_ENDPOINT_URL, AWS_REGION, METRICS_OUT.
// Read-only: DescribeLogGroups / FilterLogEvents only.
//
// Note: this AWS emulator does not emit Lambda lifecycle lines (START/REPORT),
// so per-invocation durations are NOT available from logs. Latency numbers come
// from a load test pushed to CloudWatch Metrics instead (see logs-metrics for
// usage facts, load-test.mjs for latency).
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CloudWatchLogsClient, DescribeLogGroupsCommand, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const endpoint = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
const region = process.env.AWS_REGION ?? 'us-east-1';
const outDir = process.env.METRICS_OUT ?? 'metrics';
const logs = new CloudWatchLogsClient({ region, endpoint, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
const PAGE = 2000;

const started = Date.now();
const groups = [];
let token;
do {
  const res = await logs.send(new DescribeLogGroupsCommand({ NextToken: token }));
  groups.push(...(res.logGroups ?? []));
  token = res.nextToken ?? res.NextToken;
} while (token);

function keyOf(message) {
  // Lambda log line: "2026-10-25T18:34:18.971Z\t<requestId>\tLEVEL\t..."
  if (message.startsWith('2026-') && message.includes('\t')) return message.split('\t')[2]?.trim() || 'INFO';
  if (message.startsWith('[')) return 'LOG';
  if (/level=/.test(message)) return /level=info/.test(message) ? 'INFO' : 'ERROR';
  if (message.startsWith('time=')) return 'LOG';
  return 'LOG';
}

const results = [];
for (const g of groups) {
  // This emulator's FilterLogEvents pagination always returns the first page,
  // so dedupe by eventId and stop as soon as a page brings nothing new.
  const byId = new Map();
  let token2;
  while (byId.size < 50000) {
    const res = await logs.send(new FilterLogEventsCommand({ logGroupName: g.logGroupName, limit: PAGE, NextToken: token2 }));
    const page = res.events ?? [];
    const before = byId.size;
    for (const e of page) if (!byId.has(e.eventId)) byId.set(e.eventId, e);
    if (!byId.size || byId.size === before || !res.nextToken) break;
    token2 = res.nextToken;
  }
  const events = [...byId.values()];

  const levels = {};
  const errors = new Map();
  let first = null;
  let last = null;
  for (const e of events) {
    const msg = e.message ?? '';
    const ts = Number(e.timestamp);
    if (first === null || ts < first) first = ts;
    if (last === null || ts > last) last = ts;
    const lvl = keyOf(msg);
    levels[lvl] = (levels[lvl] ?? 0) + 1;
    if (lvl === 'ERROR') {
      // collapse error messages to their stable core
      const parts = msg.split('\t');
      let core = msg;
      if (parts.length > 3) core = parts.slice(3).join('\t');
      const m = /errorType":"([^"]+)","errorMessage":"([^"\\]{0,60})/.exec(core);
      if (m) core = `${m[1]}: ${m[2]}`;
      core = core.slice(0, 80);
      errors.set(core, (errors.get(core) ?? 0) + 1);
    }
  }
  results.push({
    logGroup: g.logGroupName,
    storedBytes: g.storedBytes ?? 0,
    events: events.length,
    levels,
    firstEvent: first ? new Date(first).toISOString() : null,
    lastEvent: last ? new Date(last).toISOString() : null,
    spanHours: first && last ? +((last - first) / 3.6e6).toFixed(1) : null,
    topErrors: [...errors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([error, count]) => ({ error, count })),
  });
  console.log(`  ${g.logGroupName}: ${events.length} events (${Object.entries(levels).map(([l, n]) => `${l}=${n}`).join(', ') || 'empty'})`);
}

mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const jsonPath = join(outDir, `${stamp}-logs.json`);
writeFileSync(jsonPath, JSON.stringify({ collectedAt: new Date().toISOString(), endpoint, region, durationMs: Date.now() - started, groups: results }, null, 2));

const lam = results.filter((r) => r.logGroup.startsWith('/aws/lambda/'));
const totalEvents = results.reduce((a, r) => a + r.events, 0);
const totalErrors = results.reduce((a, r) => a + (r.levels.ERROR ?? 0), 0);
const firstE = results.map((r) => r.firstEvent).filter(Boolean).sort();
const lastE = results.map((r) => r.lastEvent).filter(Boolean).sort();

const lines = [];
lines.push('# CloudWatch Logs audit — ERP backend');
lines.push('');
lines.push(`_Collected ${new Date().toISOString()} via the AWS CloudWatch Logs API against \`${endpoint}\` in ${((Date.now() - started) / 1000).toFixed(1)} s._`);
lines.push('');
lines.push(`**${results.length} log groups, ${totalEvents} events, ${totalErrors} error lines, activity window ${firstE[0] ?? '?'} → ${lastE[lastE.length - 1] ?? '?'}.**`);
lines.push('');
lines.push('## Lambda functions (CloudWatch logging of invocations)');
lines.push('');
lines.push('| Function | Events | Errors | Activity span (h) | First / last event |');
lines.push('|---|---:|---:|---:|---|');
for (const r of lam.sort((a, b) => b.events - a.events)) {
  lines.push(`| \`${r.logGroup.replace('/aws/lambda/', '')}\` | ${r.events} | ${r.levels.ERROR ?? 0} | ${r.spanHours ?? '-'} | ${r.firstEvent ? r.firstEvent.slice(0, 16) : '-'} / ${r.lastEvent ? r.lastEvent.slice(0, 16) : '-'} |`);
}
lines.push('');
lines.push('## Other groups');
for (const r of results.filter((x) => !x.logGroup.startsWith('/aws/lambda/'))) {
  lines.push(`- \`${r.logGroup}\`: ${r.events} events (${Object.entries(r.levels).map(([l, n]) => `${l}=${n}`).join(', ')})`);
}
lines.push('');
lines.push('## Top errors across the backend (real logged failures)');
const errAll = new Map();
for (const r of results) for (const e of r.topErrors) errAll.set(e.error, (errAll.get(e.error) ?? 0) + e.count);
for (const [error, count] of [...errAll.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) lines.push(`- ${count} × ${error}`);
const mdPath = join(outDir, `${stamp}-logs.md`);
writeFileSync(mdPath, lines.join('\n') + '\n');
console.log('');
console.log(`Log audit complete → ${jsonPath} and ${mdPath}`);
console.log(`Groups: ${results.length} | Events: ${totalEvents} | Error lines: ${totalErrors} | Window: ${firstE[0] ?? '?'} → ${lastE[lastE.length - 1] ?? '?'}`);
