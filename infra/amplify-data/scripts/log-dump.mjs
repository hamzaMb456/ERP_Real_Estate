#!/usr/bin/env node
// One-off: dump full log lines per distinct error signature for a log group.
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const l = new CloudWatchLogsClient({ region: 'us-east-1', endpoint: 'http://localhost:4566', credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });
const g = process.argv[2];
const want = process.argv[3]; // optional regex to filter
const r = await l.send(new FilterLogEventsCommand({ logGroupName: g, limit: 2000 }));
const ev = r.events ?? [];
const seen = new Set();
for (const e of ev) {
  const msg = (e.message ?? '').replace(/\t/g, ' | ');
  if (want && !new RegExp(want).test(msg)) continue;
  // signature: errorType+errorMessage or first 80 chars
  const m = /errorType\"?:\"?([^,\"\\\\]+)\"?,\"errorMessage\":\s*\"?([^\"\\\\]{0,80})/.exec(msg);
  const key = m ? `${m[1]} / ${m[2].slice(0, 40)}` : msg.slice(24, 90);
  if (seen.has(key)) continue;
  seen.add(key);
  console.log('===', new Date(Number(e.timestamp)).toISOString());
  console.log(msg.slice(0, 700));
}
console.log(`\n(${seen.size} distinct signatures out of ${ev.length} events)`);
