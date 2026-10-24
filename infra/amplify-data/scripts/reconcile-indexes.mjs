#!/usr/bin/env node
// Floci's CloudFormation builds a table's GSIs only when it creates the table: an index added to the
// schema later is silently skipped. Create the missing ones with UpdateTable (never deletes anything).
//
//   node scripts/reconcile-indexes.mjs <cdk.out dir> <stack name>
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CloudFormationClient, DescribeStackResourcesCommand } from '@aws-sdk/client-cloudformation';
import { DescribeTableCommand, DynamoDBClient, UpdateTableCommand } from '@aws-sdk/client-dynamodb';

const [dir, stackName] = process.argv.slice(2);
if (!dir || !stackName) {
  console.error('usage: node scripts/reconcile-indexes.mjs <cdk.out dir> <stack name>');
  process.exit(1);
}

const cfn = new CloudFormationClient({});
const db = new DynamoDBClient({});

const { StackResources } = await cfn.send(new DescribeStackResourcesCommand({ StackName: stackName }));
const apiId = StackResources.find((r) => r.ResourceType === 'AWS::AppSync::GraphQLApi')?.PhysicalResourceId?.split('/').pop();
if (!apiId) throw new Error(`no AppSync API in stack ${stackName}`);

let created = 0;
for (const file of readdirSync(dir).filter((f) => f.endsWith('.nested.template.json'))) {
  const template = JSON.parse(readFileSync(join(dir, file), 'utf8'));
  for (const [logicalId, resource] of Object.entries(template.Resources ?? {})) {
    const props = resource.Properties ?? {};
    if (resource.Type !== 'AWS::DynamoDB::Table' || !props.GlobalSecondaryIndexes?.length) continue;
    // Logical ids look like UnitTableFA8005CD; physical names like Unit-<apiId>-NONE.
    const tableName = `${logicalId.replace(/Table[0-9A-F]{8}$/, '')}-${apiId}-NONE`;
    let existing;
    try {
      existing = new Set(((await db.send(new DescribeTableCommand({ TableName: tableName }))).Table.GlobalSecondaryIndexes ?? []).map((g) => g.IndexName));
    } catch (err) {
      console.warn(`skip ${tableName}: ${err.message}`);
      continue;
    }
    for (const gsi of props.GlobalSecondaryIndexes.filter((g) => !existing.has(g.IndexName))) {
      const keyNames = new Set(gsi.KeySchema.map((k) => k.AttributeName));
      await db.send(new UpdateTableCommand({
        TableName: tableName,
        AttributeDefinitions: props.AttributeDefinitions.filter((a) => keyNames.has(a.AttributeName)),
        GlobalSecondaryIndexUpdates: [{ Create: { IndexName: gsi.IndexName, KeySchema: gsi.KeySchema, Projection: gsi.Projection } }],
      }));
      console.log(`created index ${gsi.IndexName} on ${tableName}`);
      created += 1;
    }
  }
}
console.log(created ? `${created} index(es) created` : 'indexes up to date');
