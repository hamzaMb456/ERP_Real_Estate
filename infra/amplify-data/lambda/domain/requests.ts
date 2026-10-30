// Visitor requests from the website (rent, visit) and their handling by staff, ported from
// db/migrations/0008_visitor_requests.sql and 0009_client_accounts.sql.
import { randomUUID } from 'node:crypto';
import type { Caller } from './auth.ts';
import { requireEditor } from './auth.ts';
import { todayTunis } from './dates.ts';
import { DomainError, fail } from './errors.ts';
import type { Item, TxItem } from './db.ts';
import { getItem, pick, queryAll, table, transact, versionBump } from './db.ts';
import { insertNotification } from './notifications.ts';
import type { ContactInput } from './request-rules.ts';
import { assertRentalTerms, cleanContact, isThrottled, normalizeVisitSlot } from './request-rules.ts';

const ATTEMPTS = 3;
const HOUR_MS = 3_600_000;
const STAFF_ROLES = new Set(['org_admin', 'manager']);
const RENTAL_STATUSES = new Set(['new', 'contacted', 'accepted', 'declined', 'closed']);
const VISIT_STATUSES = new Set(['new', 'confirmed', 'declined', 'done', 'cancelled']);

type Kind = 'rental' | 'visit';
const MODEL: Record<Kind, string> = { rental: 'RentalRequest', visit: 'VisitRequest' };
const STAFF_NOTICE: Record<Kind, { kind: string; title: string; link: string }> = {
  rental: { kind: 'rental_request', title: 'Nouvelle demande de location', link: '/erp/baux/demandes' },
  visit: { kind: 'visit_request', title: 'Nouvelle demande de visite', link: '/erp/visites' },
};

const throttleLockId = (orgId: string, digits: string): string => `THROTTLE#${orgId}#${digits}`;
const slotLockId = (r: Item): string => `SLOT#${r.unit_id}#${r.visit_date}#${r.visit_time}`;

export interface Receipt {
  id: string;
  kind: Kind;
}

/** require_client_on_request: only a signed-in client may submit. */
function requireClient(caller: Caller): string {
  if (caller.role !== 'user' || !caller.userId) fail('REQUEST_LOGIN_REQUIRED');
  return caller.userId;
}

async function listingFor(unitId: string): Promise<Item> {
  const listing = await getItem('PublicListing', { id: unitId });
  if (!listing) fail('REQUEST_UNIT_UNAVAILABLE');
  return listing;
}

/** Every staff member of the organization hears about a new request in the bell. */
async function notifyStaff(kind: Kind, request: Item): Promise<void> {
  const [staff, unit] = await Promise.all([
    queryAll('StaffMember', { index: 'byOrg', key: 'organization_id', value: request.organization_id }),
    getItem('Unit', { id: request.unit_id }),
  ]);
  const notice = STAFF_NOTICE[kind];
  for (const s of staff.filter((m) => STAFF_ROLES.has(m.role))) {
    await insertNotification({
      organization_id: request.organization_id, user_id: s.id, kind: notice.kind, title: notice.title,
      body: `${request.full_name} - ${unit?.code ?? ''}`, link: notice.link, dedupe_key: `${notice.kind}:${request.id}`,
    });
  }
}

/**
 * Shared submit path: listing check, contact check, throttle under a per-phone lock (two submissions
 * of one phone cannot both slip under the limit), the kind's own checks, insert, staff notice.
 */
async function submit(
  kind: Kind,
  caller: Caller,
  unitId: string,
  contactInput: ContactInput,
  fields: Item,
  checks: (orgId: string, digits: string) => Promise<void>,
  now: Date,
): Promise<Receipt> {
  const clientId = requireClient(caller);
  const listing = await listingFor(unitId);
  const contact = cleanContact(contactInput);
  const orgId = listing.organization_id as string;

  for (let attempt = 1; ; attempt += 1) {
    const [lock, recent] = await Promise.all([
      getItem('Lock', { id: throttleLockId(orgId, contact.phone_digits) }),
      queryAll(MODEL[kind], {
        index: 'byOrg', key: 'organization_id', value: orgId,
        sortKey: { name: 'created_at', condition: '#sk > :from', values: { ':from': new Date(now.getTime() - HOUR_MS).toISOString() } },
      }),
    ]);
    if (isThrottled(recent as { phone_digits: string; created_at: string }[], contact.phone_digits, now)) fail('REQUEST_TOO_MANY');
    await checks(orgId, contact.phone_digits);

    const iso = now.toISOString();
    const item = {
      __typename: MODEL[kind], id: randomUUID(), organization_id: orgId, unit_id: unitId, client_user_id: clientId,
      ...contact, ...fields, status: 'new', staff_note: null, created_at: iso, updated_at: iso,
    };
    try {
      await transact([
        versionBump(throttleLockId(orgId, contact.phone_digits), lock?.value as number | undefined),
        { Put: { TableName: table(MODEL[kind]), Item: item, ConditionExpression: 'attribute_not_exists(id)' } },
      ]);
      await notifyStaff(kind, item);
      return { id: item.id, kind };
    } catch (err) {
      if (attempt >= ATTEMPTS || !(err instanceof DomainError && err.code === 'concurrent_update')) throw err;
    }
  }
}

/** Rental request: a unit offered for rent, from today within a year, 1 to 120 months, no duplicate. */
export async function submitRentalRequest(
  caller: Caller,
  input: ContactInput & { unit_id: string; start_date: string; duration_months: number },
  now = new Date(),
): Promise<Receipt> {
  return submit('rental', caller, input.unit_id, input, { start_date: input.start_date, duration_months: input.duration_months },
    async (orgId, digits) => {
      if ((await listingFor(input.unit_id)).kind !== 'rent') fail('REQUEST_NOT_FOR_RENT');
      assertRentalTerms(input.start_date, input.duration_months, todayTunis(now));
      const sameUnit = await queryAll('RentalRequest', { index: 'byOrg', key: 'organization_id', value: orgId });
      if (sameUnit.some((r) => r.unit_id === input.unit_id && r.phone_digits === digits && r.status === 'new'
        && r.start_date === input.start_date && r.duration_months === input.duration_months)) fail('REQUEST_DUPLICATE');
    }, now);
}

/** Visit request: a valid slot, not already confirmed for the unit, no duplicate. */
export async function submitVisitRequest(
  caller: Caller,
  input: ContactInput & { unit_id: string; visit_date: string; visit_time: string },
  now = new Date(),
): Promise<Receipt> {
  requireClient(caller);
  const visitTime = normalizeVisitSlot(input.visit_date, input.visit_time, todayTunis(now));
  return submit('visit', caller, input.unit_id, input, { visit_date: input.visit_date, visit_time: visitTime, appointment_id: null },
    async (_orgId, digits) => {
      const sameDay = (await queryAll('VisitRequest', {
        index: 'byUnit', key: 'unit_id', value: input.unit_id,
        sortKey: { name: 'visit_date', condition: '#sk = :day', values: { ':day': input.visit_date } },
      })).filter((r) => r.visit_time === visitTime);
      if (sameDay.some((r) => r.status === 'confirmed')) fail('REQUEST_SLOT_TAKEN');
      if (sameDay.some((r) => r.status === 'new' && r.phone_digits === digits)) fail('REQUEST_DUPLICATE');
    }, now);
}

async function loadRequest(kind: Kind, orgId: string, id: string): Promise<Item> {
  const r = await getItem(MODEL[kind], { id });
  if (r?.organization_id !== orgId) fail('request_not_found');
  return r;
}

/** Staff handle a rental request: status and note only. */
export async function updateRentalRequest(caller: Caller, id: string, patch: { status?: string; staff_note?: string | null }): Promise<Item> {
  const orgId = requireEditor(caller, 'permission_denied');
  if (patch.status !== undefined && !RENTAL_STATUSES.has(patch.status)) fail('rental_requests_status_check');
  const current = await loadRequest('rental', orgId, id);
  const next = { ...current, ...pick(patch, ['status', 'staff_note']), updated_at: new Date().toISOString() };
  await transact([{ Put: { TableName: table('RentalRequest'), Item: next, ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': current.updated_at } } }]);
  return next;
}

/**
 * Staff handle a visit request: status, note, linked appointment. Two confirmed visits never share
 * a slot (visit_requests_one_confirmed_slot): confirming takes a slot lock, leaving 'confirmed' frees it.
 */
export async function updateVisitRequest(
  caller: Caller,
  id: string,
  patch: { status?: string; staff_note?: string | null; appointment_id?: string | null },
): Promise<Item> {
  const orgId = requireEditor(caller, 'permission_denied');
  if (patch.status !== undefined && !VISIT_STATUSES.has(patch.status)) fail('visit_requests_status_check');
  const current = await loadRequest('visit', orgId, id);
  if (patch.appointment_id) {
    const appointment = await getItem('Appointment', { id: patch.appointment_id });
    if (appointment?.organization_id !== orgId) fail('appointment_not_found');
  }
  const next = { ...current, ...pick(patch, ['status', 'staff_note', 'appointment_id']), updated_at: new Date().toISOString() };
  const items: TxItem[] = [{
    Put: { TableName: table('VisitRequest'), Item: next, ConditionExpression: 'updated_at = :seen', ExpressionAttributeValues: { ':seen': current.updated_at } },
  }];
  const wasConfirmed = current.status === 'confirmed';
  const isConfirmed = next.status === 'confirmed';
  if (isConfirmed && !wasConfirmed) {
    items.push({ Put: { TableName: table('Lock'), Item: { __typename: 'Lock', id: slotLockId(next), value: 1 }, ConditionExpression: 'attribute_not_exists(id)' } });
  }
  if (wasConfirmed && !isConfirmed) items.push({ Delete: { TableName: table('Lock'), Key: { id: slotLockId(current) } } });
  await transact(items, isConfirmed && !wasConfirmed ? 'visit_requests_one_confirmed_slot' : 'concurrent_update');
  return next;
}
