#!/usr/bin/env node
// Dev seed: one organization with a branch, property, unit and contact (fixed ids, idempotent).
//   node scripts/seed.mjs [apiId]   apiId only needed when several ERP APIs exist on Floci.
import { DynamoDBClient, ListTablesCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';

process.env.AWS_ENDPOINT_URL ??= 'http://localhost:4566';
process.env.AWS_REGION ??= 'us-east-1';
process.env.AWS_ACCESS_KEY_ID ??= 'test';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test';

const db = new DynamoDBClient({});
const ORG = '00000000-0000-4000-8000-000000000001';
const now = new Date().toISOString();
const stamp = { created_at: now, updated_at: now };

async function findApiId(requested) {
  const names = [];
  let ExclusiveStartTableName;
  do {
    const page = await db.send(new ListTablesCommand({ ExclusiveStartTableName }));
    names.push(...page.TableNames);
    ExclusiveStartTableName = page.LastEvaluatedTableName;
  } while (ExclusiveStartTableName);
  // Organization exists only in the ERP schema, so it identifies ERP APIs.
  const ids = names.filter((n) => n.startsWith('Organization-')).map((n) => n.split('-')[1]);
  if (requested) {
    if (!ids.includes(requested)) throw new Error(`no ERP tables for api ${requested}`);
    return requested;
  }
  if (ids.length !== 1) throw new Error(`expected one ERP api, found [${ids.join(', ')}]; pass the api id`);
  return ids[0];
}

const apiId = await findApiId(process.argv[2]);
const put = (model, item) => db.send(new PutItemCommand({
  TableName: `${model}-${apiId}-NONE`,
  Item: marshall({ __typename: model, ...stamp, ...item }, { removeUndefinedValues: true }),
}));

await put('Organization', { id: ORG, name: 'Agence Démo' });
await put('Branch', { id: '00000000-0000-4000-8000-000000000002', organization_id: ORG, name: 'Siège', city: 'Tunis' });
await put('Property', {
  id: '00000000-0000-4000-8000-000000000003', organization_id: ORG, branch_id: '00000000-0000-4000-8000-000000000002',
  name: 'Résidence Démo', type: 'building', city: 'Tunis',
});
await put('Unit', {
  id: '00000000-0000-4000-8000-000000000004', organization_id: ORG, property_id: '00000000-0000-4000-8000-000000000003',
  code: 'A1', type: 'apartment', status: 'vacant', rent_amount: 950,
});
await put('Contact', {
  id: '00000000-0000-4000-8000-000000000005', organization_id: ORG, full_name: 'Client Démo', roles: ['owner'],
});
console.log(`seeded api ${apiId}`);
