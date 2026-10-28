// Calendar (the calendar_feed view: appointments + all-day lease events) and the notification bell.
import type { Caller } from '../../domain/auth.ts';
import { resendInvitation, saveAppointment } from '../../domain/appointments.ts';
import type { AppointmentInput, ParticipantInput } from '../../domain/appointments.ts';
import { addDays } from '../../domain/dates.ts';
import type { Item } from '../../domain/db.ts';
import { batchGet, getItem, queryAll } from '../../domain/db.ts';
import { fail } from '../../domain/errors.ts';
import { LEASE_RULES } from '../../domain/lease-rules.ts';
import { markNotificationsRead } from '../../domain/notifications.ts';
import type { Where } from '../query-eval.ts';
import { matches, page, sortRows } from '../query-eval.ts';
import { active, byOrg, contactsById, count } from '../org-data.ts';
import type { Op } from '../registry.ts';
import { STAFF, WRITERS, mutation, query } from '../registry.ts';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
/** Midnight in Tunis (UTC+1, no daylight saving), as an instant. */
const tunisMidnight = (day: string): string => new Date(`${day}T00:00:00+01:00`).toISOString();

/** Every feed row of an organization; appointments limited to those starting by `to` when given. */
async function feedRows(orgId: string, to?: string): Promise<Item[]> {
  const [appointments, leases, units, properties] = await Promise.all([
    to
      ? queryAll('Appointment', { index: 'byOrgStart', key: 'organization_id', value: orgId, sortKey: { name: 'starts_at', condition: '#sk <= :to', values: { ':to': to } } })
      : queryAll('Appointment', { index: 'byOrgStart', key: 'organization_id', value: orgId }),
    byOrg('Lease', orgId), byOrg('Unit', orgId), byOrg('Property', orgId),
  ]);
  const branchOfUnit = new Map<string, string | null>();
  const propertyById = new Map(properties.map((p) => [p.id as string, p]));
  for (const u of units) branchOfUnit.set(u.id, propertyById.get(u.property_id)?.branch_id ?? null);

  const participants = await Promise.all(appointments.map((a) => queryAll('AppointmentParticipant', { key: 'appointment_id', value: a.id })));
  const rows: Item[] = appointments.map((a, i) => ({
    event_id: `a:${a.id}`, organization_id: orgId, source: 'appointment', kind: a.kind, title: a.title,
    starts_at: a.starts_at, ends_at: a.ends_at, all_day: false, status: a.status, appointment_id: a.id, lease_id: a.lease_id ?? null,
    unit_id: a.unit_id ?? null, branch_id: a.unit_id ? branchOfUnit.get(a.unit_id) ?? null : null, assigned_user_id: a.assigned_user_id ?? null,
    contact_ids: participants[i].map((p) => p.contact_id).sort(), location: a.location ?? null, notify_by_email: a.notify_by_email ?? false,
  }));

  const activeLeases = leases.filter((l) => l.status === 'active' && !l.archived_at);
  const leaseParties = await Promise.all(activeLeases.map((l) => queryAll('LeaseParty', { key: 'lease_id', value: l.id })));
  activeLeases.forEach((l, i) => {
    const contactIds = leaseParties[i].map((p) => p.contact_id).sort();
    const events: [string, string | null][] = [
      ['lease_start', l.start_date], ['lease_end', l.end_date],
      ['registration_deadline', !l.registered_at && l.signed_at ? addDays(l.signed_at, LEASE_RULES.registration_days) : null],
    ];
    for (const unitId of (l.unit_ids as string[] | undefined) ?? []) {
      for (const [kind, day] of events) {
        if (!day) continue;
        rows.push({
          event_id: `l:${l.id}:${unitId}:${kind}`, organization_id: orgId, source: 'lease', kind, title: `Bail ${l.number}`,
          starts_at: tunisMidnight(day), ends_at: tunisMidnight(addDays(day, 1)), all_day: true, status: l.status,
          appointment_id: null, lease_id: l.id, unit_id: unitId, branch_id: branchOfUnit.get(unitId) ?? null,
          assigned_user_id: null, contact_ids: contactIds, location: null, notify_by_email: false,
        });
      }
    }
  });
  return rows;
}

async function ownedAppointment(caller: Caller, id: string): Promise<Item> {
  const a = await getItem('Appointment', { id });
  if (a?.organization_id !== caller.orgId) fail('appointment_not_found');
  return a;
}

/** Full input for saveAppointment from the stored appointment plus changed columns. */
function mergedInput(current: Item, set: Item, participants?: ParticipantInput[]): AppointmentInput {
  const next = { ...current, ...set };
  return {
    id: current.id, kind: next.kind, title: next.title, location: next.location, starts_at: next.starts_at, ends_at: next.ends_at,
    status: next.status, assigned_user_id: next.assigned_user_id, unit_id: next.unit_id, lease_id: next.lease_id,
    notify_by_email: next.notify_by_email, notes: next.notes, ...(participants ? { participants } : {}),
  };
}

export const calendarOps: Record<string, Op> = {
  CalendarFeed: query(STAFF, async (c, v) => {
    const rows = (await feedRows(c.orgId, str(v.to))).filter((r) => matches(r, { starts_at: { _lte: v.to }, ends_at: { _gte: v.from } }));
    return { calendar_feed: page(sortRows(rows, [{ starts_at: 'asc' }]), 1000) };
  }),
  CalendarFeedRows: query(STAFF, async (c, v) => ({
    calendar_feed: page(sortRows((await feedRows(c.orgId)).filter((r) => matches(r, v.where as Where)), [{ starts_at: 'desc' }]), 500),
  })),
  CalendarLookups: query(STAFF, async (c) => {
    const [staff, branches] = await Promise.all([byOrg('StaffMember', c.orgId), byOrg('Branch', c.orgId)]);
    return {
      staff_members: sortRows(staff, [{ display_name: 'asc' }]).map((s) => ({ user_id: s.id, display_name: s.display_name, email: s.email, role: s.role })),
      branches: sortRows(branches, [{ name: 'asc' }]).map((b) => ({ id: b.id, name: b.name })),
    };
  }),
  Appointment: query(STAFF, async (c, v) => {
    const a = await getItem('Appointment', { id: str(v.id) });
    if (a?.organization_id !== c.orgId) return { appointment: null };
    const [staff, unit, lease, participants] = await Promise.all([
      a.assigned_user_id ? getItem('StaffMember', { id: a.assigned_user_id }) : undefined,
      a.unit_id ? getItem('Unit', { id: a.unit_id }) : undefined,
      a.lease_id ? getItem('Lease', { id: a.lease_id }) : undefined,
      queryAll('AppointmentParticipant', { key: 'appointment_id', value: a.id }),
    ]);
    const [property, contacts] = await Promise.all([unit ? getItem('Property', { id: unit.property_id }) : undefined, contactsById(participants.map((p) => p.contact_id))]);
    return {
      appointment: {
        id: a.id, kind: a.kind, title: a.title, location: a.location, starts_at: a.starts_at, ends_at: a.ends_at, status: a.status,
        assigned_user_id: a.assigned_user_id, unit_id: a.unit_id, lease_id: a.lease_id, notify_by_email: a.notify_by_email, notes: a.notes,
        assigned_user: staff ? { display_name: staff.display_name } : null,
        unit: unit ? { id: unit.id, code: unit.code, property: { id: unit.property_id, name: property?.name ?? '' } } : null,
        lease: lease ? { id: lease.id, number: lease.number } : null,
        participants: sortRows(participants, [{ created_at: 'asc' }]).map((p) => {
          const contact = contacts.get(p.contact_id);
          return { contact_id: p.contact_id, role: p.role, email_status: p.email_status, contact: { id: p.contact_id, full_name: contact?.full_name ?? '', email: contact?.email ?? null } };
        }),
      },
    };
  }),
  AppointmentUnits: query(STAFF, async (c) => {
    const [units, properties] = await Promise.all([byOrg('Unit', c.orgId), byOrg('Property', c.orgId)]);
    const live = new Map(active(properties).map((p) => [p.id as string, p]));
    const rows = active(units).filter((u) => live.has(u.property_id)).map((u) => ({ id: u.id, code: u.code, property: { name: live.get(u.property_id)!.name } }));
    return { units: sortRows(rows, [{ property: { name: 'asc' } }, { code: 'asc' }]) };
  }),
  ContactAppointments: query(STAFF, async (c, v) => {
    const contact = await getItem('Contact', { id: str(v.contactId) });
    if (contact?.organization_id !== c.orgId) return { appointment_participants: [] };
    const rows = await queryAll('AppointmentParticipant', { index: 'byContact', key: 'contact_id', value: contact.id });
    const appointments = new Map((await batchGet('Appointment', rows.map((r) => r.appointment_id))).map((a) => [a.id as string, a]));
    const joined = rows.filter((r) => appointments.has(r.appointment_id)).map((r) => {
      const a = appointments.get(r.appointment_id)!;
      return { role: r.role, email_status: r.email_status, appointment: { id: a.id, title: a.title, kind: a.kind, status: a.status, starts_at: a.starts_at, ends_at: a.ends_at, location: a.location, unit_id: a.unit_id, lease_id: a.lease_id } };
    });
    return { appointment_participants: page(sortRows(joined, [{ appointment: { starts_at: 'desc' } }]), 200) };
  }),

  InsertAppointment: mutation(WRITERS, async (c, v) => {
    const a = (v.appointment ?? {}) as Item;
    const participants = ((v.participants as Item[]) ?? []).map((p) => ({ contact_id: p.contact_id, role: p.role }));
    const { id, ...fields } = a;
    const saved = await saveAppointment(c, { ...(fields as AppointmentInput), create_id: id, participants });
    return { insert_appointments_one: { id: saved.id }, insert_appointment_participants: { affected_rows: participants.length } };
  }),
  /** Built dynamically by the web: any of $set, $remove (contact ids), $add (participant rows). */
  UpdateAppointment: mutation(WRITERS, async (c, v) => {
    const current = await ownedAppointment(c, str(v.id));
    const remove = new Set((v.remove as string[] | undefined) ?? []);
    const add = ((v.add as Item[] | undefined) ?? []).map((p) => ({ contact_id: p.contact_id, role: p.role }));
    const changesParticipants = remove.size > 0 || add.length > 0;
    let participants: ParticipantInput[] | undefined;
    if (changesParticipants) {
      const existing = await queryAll('AppointmentParticipant', { key: 'appointment_id', value: current.id });
      participants = [...existing.filter((p) => !remove.has(p.contact_id)).map((p) => ({ contact_id: p.contact_id, role: p.role })), ...add];
    }
    await saveAppointment(c, mergedInput(current, (v.set ?? {}) as Item, participants));
    return {
      ...(v.set ? { update_appointments_by_pk: { id: current.id } } : {}),
      ...(remove.size ? { delete_appointment_participants: { affected_rows: remove.size } } : {}),
      ...(add.length ? { insert_appointment_participants: { affected_rows: add.length } } : {}),
    };
  }),
  SetAppointmentStatus: mutation(WRITERS, async (c, v) => {
    const current = await ownedAppointment(c, str(v.id));
    await saveAppointment(c, mergedInput(current, { status: v.status }));
    return { update_appointments_by_pk: { id: current.id } };
  }),
  ResendParticipant: mutation(WRITERS, async (c, v) => {
    await resendInvitation(c, str(v.appointmentId), str(v.contactId));
    return { update_appointment_participants_by_pk: { appointment_id: str(v.appointmentId) } };
  }),

  /** The bell: the caller's own notifications. */
  Notifications: query(STAFF, async (c) => {
    const rows = await queryAll('Notification', { index: 'byUser', key: 'user_id', value: c.userId });
    const mine = rows.filter((n) => n.organization_id === c.orgId);
    return {
      notifications: page(sortRows(mine, { created_at: 'desc' }), 20).map((n) => ({ id: n.id, kind: n.kind, title: n.title, link: n.link, lease_id: n.lease_id, appointment_id: n.appointment_id, read_at: n.read_at, created_at: n.created_at })),
      notifications_aggregate: count(mine.filter((n) => !n.read_at).length),
    };
  }),
  MarkNotificationRead: mutation(STAFF, async (c, v) => {
    await markNotificationsRead(c, [str(v.id)]);
    return { update_notifications_by_pk: { id: str(v.id) } };
  }),
  MarkAllNotificationsRead: mutation(STAFF, async (c) => ({ update_notifications: { affected_rows: await markNotificationsRead(c) } })),
};
