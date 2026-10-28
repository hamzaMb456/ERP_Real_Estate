#!/usr/bin/env node
// Check current health of the Api lambda log group: events per day, since a date.
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const l = new CloudWatchLogsClient({ region: 'us-east-1', endpoint: 'http://localhost:4566', credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
const g = process.argv[2];
const since = process.argv[3] ? Date.parse(process.argv[3]) : undefined;

const r = await l.send(new FilterLogEventsCommand({ logGroupName: g, limit: 2000, startTime: since }));
const ev = r.events ?? [];
const byDay = new Map();
const byLevel = new Map();
for (const e of ev) {
  const d = new Date(Number(e.timestamp)).toISOString().slice(0, 10);
  byDay.set(d, (byDay.get(d) ?? 0) + 1);
  const lvl = (e.message ?? '').split('\t')[2] || 'LOG';
  byLevel.set(lvl, (byLevel.get(lvl) ?? 0) + 1);
}
console.log(`events since ${since ? new Date(since).toISOString() : 'beginning'}:`, ev.length);
console.log('first:', ev.length ? new Date(Number(ev[0].timestamp)).toISOString() : '-', ' last:', ev.length ? new Date(Number(ev[ev.length - 1].timestamp)).toISOString() : '-');
console.log('byDay:', [...byDay.entries()]);
console.log('byLevel:', [...byLevel.entries()]);
