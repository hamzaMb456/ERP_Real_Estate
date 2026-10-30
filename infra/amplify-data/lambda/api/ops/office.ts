// Visitor requests (ERP side), photos and documents, settings, data gaps, storage ownership.
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import type { Caller } from '../../domain/auth.ts';
import { requireWriter } from '../../domain/auth.ts';
import { contactIdsInScope, fileTargetVisible, unitIdsInScope, unitVisible } from '../../domain/access.ts';
import { deleteAppointment, saveAppointment } from '../../domain/appointments.ts';
import type { AppointmentInput } from '../../domain/appointments.ts';
import type { Item } from '../../domain/db.ts';
import { doc, getItem, queryAll, table } from '../../domain/db.ts';
import { fail } from '../../domain/errors.ts';
import type { Bucket } from '../../domain/files.ts';
import { canAccessStorageFile, forgetStorageFile, linkFile, registerStorageFile, setCover, updateFileLink } from '../../domain/files.ts';
import { syncPublicListingsFor } from '../../domain/public-listings.ts';
import { recordGaps } from '../../domain/record-gaps.ts';
import { updateRentalRequest, updateVisitRequest } from '../../domain/requests.ts';
import type { Where } from '../query-eval.ts';
import { eqValue, matches, page, sortRows } from '../query-eval.ts';
import { byOrg } from '../org-data.ts';
import type { Op } from '../registry.ts';
import { EDITORS, REGIONAL, STAFF, WRITERS, mutation, query } from '../registry.ts';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const PAYMENT_METHODS = new Set(['virtual', 'manual']);

/** A file link the caller may change: its property, unit or lease must be in their branches. */
async function writableLink(caller: Caller, id: string): Promise<Item> {
  const link = await getItem('FileLink', { id });
  if (link?.organization_id !== caller.orgId || !(await fileTargetVisible(caller, link))) fail('out_of_scope');
  return link;
}

/** A request the caller may change: its unit must be one of theirs (the manager: any request of the organization). */
async function writableRequest(caller: Caller, model: 'RentalRequest' | 'VisitRequest', id: string): Promise<Item> {
  const row = await getItem(model, { id });
  if (row?.organization_id !== caller.orgId || !unitVisible(await unitIdsInScope(caller), row.unit_id)) fail('request_not_found');
  return row;
}

/** Requests with their unit { id code title property { id name city } }, newest first, only for the units in scope. */
async function requestsWithUnits(model: string, orgId: string, units: Set<string> | null): Promise<Item[]> {
  const [allRows, allUnits, properties] = await Promise.all([byOrg(model, orgId), byOrg('Unit', orgId), byOrg('Property', orgId)]);
  const rows = allRows.filter((r) => unitVisible(units, r.unit_id));
  const unitById = new Map(allUnits.map((u) => [u.id as string, u]));
  const propertyById = new Map(properties.map((p) => [p.id as string, p]));
  return page(sortRows(rows, { created_at: 'desc' }), 500).map((r) => {
    const u = unitById.get(r.unit_id);
    const p = u ? propertyById.get(u.property_id) : undefined;
    const { phone_digits: _digits, client_user_id: _client, __typename: _t, organization_id: _o, ...rest } = r;
    return {
      ...rest,
      unit: u ? { id: u.id, code: u.code, title: u.title ?? null, visit_fee: u.visit_fee ?? null, property: p ? { id: p.id, name: p.name, city: p.city } : null } : null,
    };
  });
}

/** Photos/Documents send a where naming one target (property_id or unit_id): read that target's files. */
async function targetFiles(caller: Caller, where: Where): Promise<Item[]> {
  const propertyId = eqValue(where, 'property_id');
  const unitId = eqValue(where, 'unit_id');
  const [model, id] = typeof propertyId === 'string' ? ['Property', propertyId] : typeof unitId === 'string' ? ['Unit', unitId] : [null, null];
  if (!model || !id) fail('file_target_required');
  const owner = await getItem(model, { id });
  if (owner?.organization_id !== caller.orgId) return [];
  if (!(await fileTargetVisible(caller, model === 'Property' ? { property_id: id } : { unit_id: id }))) return [];
  const files = await queryAll('FileLink', { index: 'byTarget', key: 'target_key', value: `${model.toLowerCase()}#${id}` });
  return files.filter((f) => matches(f, where));
}

export const officeOps: Record<string, Op> = {
  RentalRequests: query(REGIONAL, async (c) => ({ rental_requests: await requestsWithUnits('RentalRequest', c.orgId, await unitIdsInScope(c)) })),
  VisitRequests: query(REGIONAL, async (c) => ({ visit_requests: await requestsWithUnits('VisitRequest', c.orgId, await unitIdsInScope(c)) })),
  SetRentalRequest: mutation(EDITORS, async (c, v) => {
    await writableRequest(c, 'RentalRequest', str(v.id));
    return { update_rental_requests_by_pk: { id: (await updateRentalRequest(c, str(v.id), (v.set ?? {}) as Item)).id } };
  }),
  SetVisitRequest: mutation(EDITORS, async (c, v) => {
    await writableRequest(c, 'VisitRequest', str(v.id));
    return { update_visit_requests_by_pk: { id: (await updateVisitRequest(c, str(v.id), (v.set ?? {}) as Item)).id } };
  }),
  /** Appointment first, then the request takes the slot; if the slot is taken, the appointment is removed again. */
  ConfirmVisit: mutation(EDITORS, async (c, v) => {
    const units = await unitIdsInScope(c);
    await writableRequest(c, 'VisitRequest', str(v.id));
    const { id: appointmentId, ...fields } = (v.appointment ?? {}) as Item;
    if (fields.unit_id !== undefined && !unitVisible(units, fields.unit_id)) fail('out_of_scope');
    const appointment = await saveAppointment(c, { ...(fields as AppointmentInput), create_id: appointmentId });
    try {
      await updateVisitRequest(c, str(v.id), { status: 'confirmed', appointment_id: appointment.id });
    } catch (err) {
      await deleteAppointment(c, appointment.id).catch((cleanup: Error) => console.error('ConfirmVisit cleanup failed:', cleanup.message));
      throw err;
    }
    return { insert_appointments_one: { id: appointment.id }, update_visit_requests_by_pk: { id: str(v.id) } };
  }),
  CloseVisit: mutation(EDITORS, async (c, v) => {
    const units = await unitIdsInScope(c);
    await writableRequest(c, 'VisitRequest', str(v.id));
    await updateVisitRequest(c, str(v.id), { status: str(v.status) });
    const current = await getItem('Appointment', { id: str(v.appointmentId) });
    if (current?.organization_id !== c.orgId) fail('appointment_not_found');
    if (!unitVisible(units, current.unit_id)) fail('out_of_scope');
    await saveAppointment(c, {
      id: current.id, kind: current.kind, title: current.title, location: current.location, starts_at: current.starts_at, ends_at: current.ends_at,
      status: str(v.appointmentStatus), assigned_user_id: current.assigned_user_id, unit_id: current.unit_id, lease_id: current.lease_id,
      notify_by_email: current.notify_by_email, notes: current.notes,
    });
    return { update_visit_requests_by_pk: { id: str(v.id) }, update_appointments_by_pk: { id: current.id } };
  }),

  Photos: query(REGIONAL, async (c, v) => ({
    property_files: sortRows(await targetFiles(c, v.where as Where), [{ sort_order: 'asc' }, { created_at: 'asc' }])
      .map((f) => ({ id: f.id, storage_file_id: f.storage_file_id, title: f.title, is_cover: f.is_cover, sort_order: f.sort_order })),
  })),
  Documents: query(REGIONAL, async (c, v) => ({
    property_files: sortRows(await targetFiles(c, v.where as Where), [{ created_at: 'desc' }])
      .map((f) => ({ id: f.id, storage_file_id: f.storage_file_id, title: f.title, category: f.category, created_at: f.created_at })),
  })),
  LinkFile: mutation(EDITORS, async (c, v) => {
    if (!(await fileTargetVisible(c, v.object as Item))) fail('out_of_scope');
    return { insert_property_files_one: { id: (await linkFile(c, v.object as never)).id } };
  }),
  SetCover: mutation(EDITORS, async (c, v) => {
    await writableLink(c, str(v.id));
    await setCover(c, str(v.id));
    return { update_property_files: { affected_rows: 1 }, update_property_files_by_pk: { id: str(v.id) } };
  }),
  SwapOrder: mutation(EDITORS, async (c, v) => {
    await writableLink(c, str(v.a));
    await writableLink(c, str(v.b));
    await updateFileLink(c, str(v.a), { sort_order: Number(v.aOrder) });
    await updateFileLink(c, str(v.b), { sort_order: Number(v.bOrder) });
    return { first: { id: str(v.a) }, second: { id: str(v.b) } };
  }),
  /** Storage routes: is this object linked to something the caller may see? */
  StorageFileOwnership: query(REGIONAL, async (c, v) => {
    const key = str(v.key);
    if (!(await canAccessStorageFile(c, key))) return { property_files: [], lease_files: [] };
    const lock = await getItem('Lock', { id: `UNIQ#file#${key}` });
    const link = lock?.file_id ? await getItem('FileLink', { id: lock.file_id }) : undefined;
    if (!link) return { property_files: [], lease_files: [] };
    return link.lease_id ? { property_files: [], lease_files: [{ id: link.id }] } : { property_files: [{ id: link.id }], lease_files: [] };
  }),

  /** Upload route, after the S3 put: the caller becomes the object's uploader (replaces raw SQL on app_storage_files). */
  RegisterStorageFile: mutation(EDITORS, async (c, v) => {
    if (!/^[0-9a-f-]{36}$/i.test(str(v.key))) fail('invalid_storage_file');
    await registerStorageFile(c.userId, str(v.key), str(v.bucket) as Bucket);
    return { insert_app_storage_files_one: { id: str(v.key) } };
  }),
  ForgetStorageFile: mutation(EDITORS, async (c, v) => {
    await forgetStorageFile(c, str(v.key));
    return { delete_app_storage_files_by_pk: { id: str(v.key) } };
  }),

  VisitPaymentMethod: query(STAFF, async (c) => {
    const org = await getItem('Organization', { id: c.orgId });
    return {
      organizations: org
        ? [{ id: org.id, visit_payment_method: org.visit_payment_method ?? null, visit_payment_instructions: org.visit_payment_instructions ?? null }]
        : [],
    };
  }),
  /** org_admin only; 'virtual' needs non-blank instructions (how the visitor actually pays); the website shows both, so every listing of the org is rewritten. */
  SetVisitPaymentMethod: mutation(['org_admin'], async (c, v) => {
    requireWriter(c, 'permission_denied');
    if (str(v.id) !== c.orgId) fail('permission_denied');
    const value = v.value == null ? null : str(v.value);
    if (value !== null && !PAYMENT_METHODS.has(value)) fail('organizations_visit_payment_method_check');
    const instructions = v.instructions == null ? null : str(v.instructions).trim() || null;
    if (value === 'virtual' && !instructions) fail('organizations_visit_payment_instructions_required');
    const org = await getItem('Organization', { id: c.orgId });
    if (!org) fail('organization_not_found');
    await doc.send(new PutCommand({
      TableName: table('Organization'),
      Item: { ...org, visit_payment_method: value, visit_payment_instructions: value === 'virtual' ? instructions : null, updated_at: new Date().toISOString() },
    }));
    await syncPublicListingsFor('byOrg', c.orgId);
    return { update_organizations_by_pk: { id: c.orgId } };
  }),

  RecordGaps: query(REGIONAL, async (c) => {
    const [allProperties, allUnits, allContacts] = await Promise.all([byOrg('Property', c.orgId), byOrg('Unit', c.orgId), byOrg('Contact', c.orgId)]);
    const unitSet = await unitIdsInScope(c);
    const contactSet = await contactIdsInScope(c, unitSet);
    const units = unitSet === null ? allUnits : allUnits.filter((u) => unitSet.has(u.id as string));
    const propertyIds = new Set(units.map((u) => u.property_id as string));
    const properties = unitSet === null ? allProperties : allProperties.filter((p) => propertyIds.has(p.id as string));
    const contacts = contactSet === null ? allContacts : allContacts.filter((x) => contactSet.has(x.id as string));
    return {
      record_gaps: sortRows(recordGaps(properties, units, contacts), [{ entity_type: 'asc' }, { entity_label: 'asc' }])
        .map(({ organization_id: _o, ...g }) => g),
    };
  }),
};
