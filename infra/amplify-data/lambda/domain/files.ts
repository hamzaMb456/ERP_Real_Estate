// Photos and documents linked to a property, a unit or a lease (property_files + lease_files),
// and the storage-ownership rules from db/migrations/0002, 0003 and 0013.
import { randomUUID } from 'node:crypto';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Caller } from './auth.ts';
import { requireWriter } from './auth.ts';
import { fail } from './errors.ts';
import type { Item, TxItem } from './db.ts';
import { doc, getItem, pick, table, transact } from './db.ts';
import { syncPublicListing } from './public-listings.ts';

export type FileTarget = { property_id: string } | { unit_id: string } | { lease_id: string };
export type Bucket = 'property-files' | 'lease-files';

const PROPERTY_CATEGORIES = new Set(['title_deed', 'plan', 'certificate', 'contract', 'other']);
const LEASE_CATEGORIES = new Set(['signed_lease', 'id_document', 'registration_receipt', 'inspection_report', 'inspection_photo', 'other']);
const BUCKETS = new Set<Bucket>(['property-files', 'lease-files']);
const FORBIDDEN = 'permission_denied';
const STAFF_READERS = new Set(['org_admin', 'manager', 'viewer']);

const uniqueLockId = (storageFileId: string): string => `UNIQ#file#${storageFileId}`;
const coverLockId = (targetKey: string): string => `COVER#${targetKey}`;

export interface LinkInput {
  property_id?: string;
  unit_id?: string;
  lease_id?: string;
  storage_file_id: string;
  kind?: 'photo' | 'document';
  category?: string | null;
  title: string;
  is_cover?: boolean;
  sort_order?: number;
}

interface ResolvedTarget {
  key: string;
  model: 'Property' | 'Unit' | 'Lease';
  id: string;
  bucket: Bucket;
}

/** property_files_one_target: exactly one of property, unit, lease. */
function resolveTarget(input: LinkInput): ResolvedTarget {
  const targets = [
    input.property_id && { key: `property#${input.property_id}`, model: 'Property' as const, id: input.property_id, bucket: 'property-files' as const },
    input.unit_id && { key: `unit#${input.unit_id}`, model: 'Unit' as const, id: input.unit_id, bucket: 'property-files' as const },
    input.lease_id && { key: `lease#${input.lease_id}`, model: 'Lease' as const, id: input.lease_id, bucket: 'lease-files' as const },
  ].filter((t): t is ResolvedTarget => Boolean(t));
  if (targets.length !== 1) fail('property_files_one_target');
  return targets[0];
}

/** The column checks of property_files and lease_files. */
export function validateLink(input: LinkInput, target: Pick<ResolvedTarget, 'model'>): { kind: string; category: string | null } {
  if (typeof input.title !== 'string' || input.title.trim() === '') fail('property_files_title_check');
  if (target.model === 'Lease') {
    const category = input.category ?? 'other';
    if (!LEASE_CATEGORIES.has(category)) fail('lease_files_category_check');
    if (input.is_cover) fail('property_files_cover_is_photo');
    return { kind: 'document', category };
  }
  const kind = input.kind ?? 'photo';
  if (kind !== 'photo' && kind !== 'document') fail('property_files_kind_check');
  const category = input.category ?? null;
  if (kind === 'photo' ? category !== null : !PROPERTY_CATEGORIES.has(category ?? '')) fail('property_files_category_matches_kind');
  if (input.is_cover && kind !== 'photo') fail('property_files_cover_is_photo');
  return { kind, category };
}

/** Called by the upload route after the S3 put: records which bucket and which user own the object. */
export async function registerStorageFile(uploaderUserId: string, storageFileId: string, bucket: Bucket): Promise<void> {
  if (!BUCKETS.has(bucket)) fail('app_storage_files_bucket_check');
  await doc.send(new PutCommand({
    TableName: table('StorageFile'),
    Item: { __typename: 'StorageFile', id: storageFileId, bucket, uploaded_by_user_id: uploaderUserId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    ConditionExpression: 'attribute_not_exists(id)',
  }));
}

/**
 * Link an uploaded file. The file must be in the target's bucket and uploaded by the caller,
 * otherwise a guessed file id from another organization could be linked and then read.
 */
export async function linkFile(caller: Caller, input: LinkInput): Promise<Item> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const target = resolveTarget(input);
  const { kind, category } = validateLink(input, target);
  const [owner, storage] = await Promise.all([
    getItem(target.model, { id: target.id }),
    getItem('StorageFile', { id: input.storage_file_id }),
  ]);
  if (owner?.organization_id !== orgId) fail('file_target_not_found');
  if (storage?.bucket !== target.bucket || storage?.uploaded_by_user_id !== caller.userId) fail('invalid_storage_file');

  const now = new Date().toISOString();
  const link = {
    __typename: 'FileLink', id: randomUUID(), organization_id: orgId, target_key: target.key,
    property_id: input.property_id ?? null, unit_id: input.unit_id ?? null, lease_id: input.lease_id ?? null,
    storage_file_id: input.storage_file_id, kind, category, title: input.title.trim(),
    is_cover: Boolean(input.is_cover), sort_order: input.sort_order ?? 0, created_at: now, updated_at: now,
  };
  const items: TxItem[] = [
    { Put: { TableName: table('FileLink'), Item: link, ConditionExpression: 'attribute_not_exists(id)' } },
    { Put: { TableName: table('Lock'), Item: { __typename: 'Lock', id: uniqueLockId(input.storage_file_id), file_id: link.id }, ConditionExpression: 'attribute_not_exists(id)' } },
  ];
  if (link.is_cover) {
    items.push({ Put: { TableName: table('Lock'), Item: { __typename: 'Lock', id: coverLockId(target.key), file_id: link.id }, ConditionExpression: 'attribute_not_exists(id)' } });
  }
  await transact(items, link.is_cover ? 'property_files_one_cover' : 'property_files_storage_file_id_key');
  if (input.unit_id) await syncPublicListing(input.unit_id);
  return link;
}

async function loadLink(orgId: string, id: string): Promise<Item> {
  const link = await getItem('FileLink', { id });
  if (link?.organization_id !== orgId) fail('file_not_found');
  return link;
}

const putLinkIfUnchanged = (next: Item, seen: string): TxItem => ({
  Put: { TableName: table('FileLink'), Item: next, ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': seen } },
});

/** Rename, recategorize or reorder a file (kind and target never change). */
export async function updateFileLink(caller: Caller, id: string, patch: { title?: string; category?: string | null; sort_order?: number }): Promise<Item> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const link = await loadLink(orgId, id);
  const next = { ...link, ...pick(patch, ['title', 'category', 'sort_order']), updated_at: new Date().toISOString() };
  validateLink(next as LinkInput, { model: link.lease_id ? 'Lease' : 'Unit' });
  await transact([putLinkIfUnchanged(next, link.updated_at)]);
  if (link.unit_id) await syncPublicListing(link.unit_id);
  return next;
}

/** Make a photo the cover of its target; the previous cover stops being one, atomically. */
export async function setCover(caller: Caller, id: string): Promise<void> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const link = await loadLink(orgId, id);
  if (link.kind !== 'photo') fail('property_files_cover_is_photo');
  if (link.is_cover) return;
  const lock = await getItem('Lock', { id: coverLockId(link.target_key) });
  const previous = lock?.file_id ? await getItem('FileLink', { id: lock.file_id }) : undefined;
  const now = new Date().toISOString();
  const items: TxItem[] = [
    putLinkIfUnchanged({ ...link, is_cover: true, updated_at: now }, link.updated_at),
    {
      Put: {
        TableName: table('Lock'),
        Item: { __typename: 'Lock', id: coverLockId(link.target_key), file_id: link.id },
        ...(lock ? { ConditionExpression: 'file_id = :old', ExpressionAttributeValues: { ':old': lock.file_id } } : { ConditionExpression: 'attribute_not_exists(id)' }),
      },
    },
  ];
  if (previous) items.push(putLinkIfUnchanged({ ...previous, is_cover: false, updated_at: now }, previous.updated_at));
  await transact(items);
  if (link.unit_id) await syncPublicListing(link.unit_id);
}

/** Unlink a file (the S3 object itself is removed by the storage route). */
export async function unlinkFile(caller: Caller, id: string): Promise<Item> {
  const orgId = requireWriter(caller, FORBIDDEN);
  const link = await loadLink(orgId, id);
  await transact([
    { Delete: { TableName: table('FileLink'), Key: { id }, ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': link.updated_at } } },
    { Delete: { TableName: table('Lock'), Key: { id: uniqueLockId(link.storage_file_id) } } },
    ...(link.is_cover ? [{ Delete: { TableName: table('Lock'), Key: { id: coverLockId(link.target_key) } } } as TxItem] : []),
  ]);
  if (link.unit_id) await syncPublicListing(link.unit_id);
  return link;
}

/**
 * The storage delete route removed the S3 object: drop its record and, like the old ON DELETE CASCADE,
 * the link that pointed to it.
 */
export async function forgetStorageFile(caller: Caller, storageFileId: string): Promise<void> {
  requireWriter(caller, FORBIDDEN);
  if (!(await canAccessStorageFile(caller, storageFileId))) fail('invalid_storage_file');
  const lock = await getItem('Lock', { id: uniqueLockId(storageFileId) });
  if (lock?.file_id) await unlinkFile(caller, lock.file_id);
  await transact([{ Delete: { TableName: table('StorageFile'), Key: { id: storageFileId } } }]);
}

/**
 * Storage routes (presign, delete): may this caller touch the object? Yes when it is linked to a
 * record of the caller's organization, or not linked yet and uploaded by the caller.
 */
export async function canAccessStorageFile(caller: Caller, storageFileId: string): Promise<boolean> {
  const lock = await getItem('Lock', { id: uniqueLockId(storageFileId) });
  if (lock?.file_id) {
    // Linked files (signed leases, ID documents...) are for the organization's staff only.
    if (!STAFF_READERS.has(caller.role) || !caller.orgId) return false;
    const link = await getItem('FileLink', { id: lock.file_id });
    return link?.organization_id === caller.orgId;
  }
  const storage = await getItem('StorageFile', { id: storageFileId });
  return Boolean(caller.userId) && storage?.uploaded_by_user_id === caller.userId;
}
