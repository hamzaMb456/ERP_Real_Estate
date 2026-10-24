// Integration tests run against the dev stack's tables on Floci: point TABLE_<MODEL> at them.
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';

/** Returns false (tests skip) when Floci is down or no single ERP api is deployed. */
export async function useDevTables(): Promise<boolean> {
  process.env.AWS_ENDPOINT_URL ??= 'http://localhost:4566';
  process.env.AWS_REGION ??= 'us-east-1';
  process.env.AWS_ACCESS_KEY_ID ??= 'test';
  process.env.AWS_SECRET_ACCESS_KEY ??= 'test';
  try {
    const db = new DynamoDBClient({});
    const names: string[] = [];
    let ExclusiveStartTableName: string | undefined;
    do {
      const page = await db.send(new ListTablesCommand({ ExclusiveStartTableName }));
      names.push(...(page.TableNames ?? []));
      ExclusiveStartTableName = page.LastEvaluatedTableName;
    } while (ExclusiveStartTableName);
    const apiId = process.env.ERP_API_ID
      ?? [...new Set(names.filter((n) => n.startsWith('Organization-')).map((n) => n.split('-')[1]))].at(0);
    if (!apiId) return false;
    for (const name of names.filter((n) => n.split('-')[1] === apiId)) {
      process.env[`TABLE_${name.split('-')[0].toUpperCase()}`] = name;
    }
    return true;
  } catch {
    return false;
  }
}
