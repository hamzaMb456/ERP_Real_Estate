#!/usr/bin/env node
// Dump every log event (full) from a group since a timestamp, with request ids.
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const l = new CloudWatchLogsClient({ region: 'us-east-1', endpoint: 'http://localhost:4566', credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
const g = process.argv[2];
const since = process.argv[3];
const r = await l.send(new FilterLogEventsCommand({ logGroupName: g, limit: 2000, startTime: Date.parse(since) }));
for (const e of r.events ?? []) {
  console.log('===', new Date(Number(e.timestamp)).toISOString(), e.logStreamName ?? '');
  console.log((e.message ?? '').replace(/\t/g, ' | ').slice(0, 900));
}
console.log(`(${(r.events ?? []).length} events)`);
