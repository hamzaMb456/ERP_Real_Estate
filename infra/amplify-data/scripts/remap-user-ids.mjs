#!/usr/bin/env node
// One-off: rewrites old Nhost user ids to Cognito subs in the stored items. Dry run unless --yes.
//
//   node scripts/remap-user-ids.mjs <apiId> <idMapFile> [--yes]
//
// idMapFile: JSON array of { old_id, new_sub }. Run scripts/backup.mjs before --yes.
import { readFileSync } from 'node:fs';
import { DeleteCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { useDevTables } from '../lambda/domain/test-env.ts';

const [apiId, mapFile] = process.argv.slice(2);
const execute = process.argv.includes('--yes');
if (!apiId || !mapFile) throw new Error('usage: remap-user-ids.mjs <apiId> <idMapFile> [--yes]');
process.env.ERP_API_ID = apiId;

const map = new Map(JSON.parse(readFileSync(mapFile, 'utf8')).map((row) => [row.old_id, row.new_sub]));
if (!(await useDevTables())) throw new Error('target tables not found');
const { doc, table, scanAll } = await import('../lambda/domain/db.ts');

const RULES = [
  { model: 'StaffMember', field: 'id' },
  { model: 'Notification', field: 'user_id' },
  { model: 'Appointment', field: 'assigned_user_id' },
  { model: 'StorageFile', field: 'uploaded_by_user_id' },
  { model: 'VisitRequest', field: 'client_user_id' },
  { model: 'RentalRequest', field: 'client_user_id' },
];

for (const rule of RULES) {
  const items = await scanAll(rule.model);
  const hits = items.filter((item) => map.has(item[rule.field]));
  console.log(`${rule.model}: ${hits.length} of ${items.length} rows hold an old user id`);
  if (!execute) continue;
  for (const item of hits) {
    const next = { ...item, [rule.field]: map.get(item[rule.field]) };
    if (rule.model === 'Notification') next.id = `${next.user_id}#${item.dedupe_key}`;
    await doc.send(new PutCommand({ TableName: table(rule.model), Item: next }));
    if (next.id !== item.id) await doc.send(new DeleteCommand({ TableName: table(rule.model), Key: { id: item.id } }));
  }
}

if (execute) {
  for (const rule of RULES) {
    const left = (await scanAll(rule.model)).filter((item) => map.has(item[rule.field])).length;
    console.log(`${rule.model}: old ids left = ${left}`);
  }
}
