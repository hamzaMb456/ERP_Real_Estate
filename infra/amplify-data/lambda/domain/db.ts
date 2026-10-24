import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { TransactWriteCommandInput, UpdateCommandInput } from '@aws-sdk/lib-dynamodb';
import { DomainError } from './errors.ts';

export const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Item = Record<string, any>;
export type TxItem = NonNullable<TransactWriteCommandInput['TransactItems']>[number];

const BATCH_GET_LIMIT = 100;

/** Table name for a model, from the TABLE_<MODEL> env vars set in backend.ts. */
export function table(model: string): string {
  const name = process.env[`TABLE_${model.toUpperCase()}`];
  if (!name) throw new Error(`missing env TABLE_${model.toUpperCase()}`);
  return name;
}

export async function getItem(model: string, key: Item): Promise<Item | undefined> {
  const out = await doc.send(new GetCommand({ TableName: table(model), Key: key, ConsistentRead: true }));
  return out.Item;
}

/** Every item with `key = value`, on the table itself or on a GSI. */
export async function queryAll(model: string, q: {
  index?: string;
  key: string;
  value: string;
  /** Optional sort-key condition on `#sk`, e.g. `#sk > :from` (names/values merged in). */
  sortKey?: { name: string; condition: string; values: Item };
}): Promise<Item[]> {
  const items: Item[] = [];
  let ExclusiveStartKey: Item | undefined;
  do {
    const page = await doc.send(new QueryCommand({
      TableName: table(model),
      IndexName: q.index,
      KeyConditionExpression: q.sortKey ? `#k = :v AND ${q.sortKey.condition}` : '#k = :v',
      ExpressionAttributeNames: { '#k': q.key, ...(q.sortKey ? { '#sk': q.sortKey.name } : {}) },
      ExpressionAttributeValues: { ':v': q.value, ...(q.sortKey?.values ?? {}) },
      // GSIs are only eventually consistent; base-table queries can be strongly consistent.
      ConsistentRead: !q.index,
      ExclusiveStartKey,
    }));
    items.push(...(page.Items ?? []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

export async function scanAll(
  model: string,
  filter?: { expression: string; names?: Record<string, string>; values: Item },
): Promise<Item[]> {
  const items: Item[] = [];
  let ExclusiveStartKey: Item | undefined;
  do {
    const page = await doc.send(new ScanCommand({
      TableName: table(model),
      FilterExpression: filter?.expression,
      ExpressionAttributeNames: filter?.names,
      ExpressionAttributeValues: filter?.values,
      ExclusiveStartKey,
    }));
    items.push(...(page.Items ?? []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return items;
}

/** Items by id (missing ids are simply absent from the result). */
export async function batchGet(model: string, ids: string[]): Promise<Item[]> {
  const name = table(model);
  const unique = [...new Set(ids)];
  const items: Item[] = [];
  for (let i = 0; i < unique.length; i += BATCH_GET_LIMIT) {
    let keys: Item[] | undefined = unique.slice(i, i + BATCH_GET_LIMIT).map((id) => ({ id }));
    while (keys && keys.length > 0) {
      const out = await doc.send(new BatchGetCommand({ RequestItems: { [name]: { Keys: keys, ConsistentRead: true } } }));
      items.push(...(out.Responses?.[name] ?? []));
      keys = out.UnprocessedKeys?.[name]?.Keys as Item[] | undefined;
    }
  }
  return items;
}

/**
 * Bump a version item in the Lock table. Put in a transaction, it makes a concurrent change to
 * the same thing (unit, counter, phone number...) fail instead of passing unseen.
 */
export function versionBump(
  id: string,
  seen: number | undefined,
  next = (seen ?? 0) + 1,
  /** Extra attributes written with the bump (e.g. the member list the lock guards). */
  extra: Item = {},
): TxItem {
  const extraKeys = Object.keys(extra);
  return {
    Update: {
      TableName: table('Lock'),
      Key: { id },
      UpdateExpression: ['SET #v = :next, #t = :type', ...extraKeys.map((_, i) => `#e${i} = :e${i}`)].join(', '),
      ExpressionAttributeNames: { '#v': 'value', '#t': '__typename', ...Object.fromEntries(extraKeys.map((k, i) => [`#e${i}`, k])) },
      ExpressionAttributeValues: {
        ':next': next, ':type': 'Lock',
        ...(seen === undefined ? {} : { ':seen': seen }),
        ...Object.fromEntries(extraKeys.map((k, i) => [`:e${i}`, extra[k]])),
      },
      ConditionExpression: seen === undefined ? 'attribute_not_exists(id)' : '#v = :seen',
    },
  };
}

/** Pick only the allowed keys of an untrusted patch (never spread caller input onto an item). */
export function pick<T extends Item>(patch: T, allowed: readonly string[]): Partial<T> {
  return Object.fromEntries(Object.entries(patch).filter(([k, v]) => allowed.includes(k) && v !== undefined)) as Partial<T>;
}

/**
 * One atomic write. A failed condition means the data changed since it was read (or a
 * unique lock is taken), reported as `conflictCode`.
 */
export async function transact(items: TxItem[], conflictCode = 'concurrent_update'): Promise<void> {
  if (items.length === 0) return;
  try {
    await doc.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (err) {
    if ((err as Error).name === 'TransactionCanceledException') throw new DomainError(conflictCode);
    throw err;
  }
}

/** A single conditional update whose failed condition is expected and harmless. */
export async function updateIfCondition(input: Omit<UpdateCommandInput, 'TableName'> & { model: string }): Promise<boolean> {
  const { model, ...rest } = input;
  try {
    await doc.send(new UpdateCommand({ TableName: table(model), ...rest }));
    return true;
  } catch (err) {
    if ((err as Error).name === 'ConditionalCheckFailedException') return false;
    throw err;
  }
}
