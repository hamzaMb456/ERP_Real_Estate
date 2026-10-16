import { handleAppointmentEmail } from '../send-appointment-email';
import type { fakeMailer } from './fakes';

export type Participant = { contact_id: string; email_status: string; contact: { email: string | null } };
export type Appointment = {
  id: string;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  status: string;
  notify_by_email: boolean;
  participants: Participant[];
};

export const part = (contactId: string, email: string | null, status = 'pending'): Participant => ({
  contact_id: contactId,
  email_status: status,
  contact: { email },
});

export const appointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'a1',
  title: 'Visite Lot 4',
  kind: 'viewing',
  starts_at: '2026-11-03T09:00:00+00:00',
  ends_at: '2026-11-03T10:00:00+00:00',
  location: 'Rue 1',
  status: 'planned',
  notify_by_email: true,
  participants: [part('c1', 'c1@x.tn')],
  ...overrides,
});

export const ENV = { NHOST_WEBHOOK_SECRET: 'sec' };
export const HEADERS = { 'x-nhost-webhook-secret': 'sec' };

export type HasuraFaults = { failWriteFor?: string[]; failRead?: boolean };

export function fakeHasura(appt: Appointment | null, faults: HasuraFaults = {}) {
  const writes: Array<{ contactId: string; set: Record<string, unknown> }> = [];
  const queries: string[] = [];
  return {
    writes,
    queries,
    client: {
      async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
        queries.push(query);
        if (query.includes('update_appointment_participants_by_pk')) {
          if (faults.failWriteFor?.includes(variables.contactId as string)) throw new Error('hasura down');
          writes.push({ contactId: variables.contactId as string, set: variables.set as Record<string, unknown> });
          return {} as T;
        }
        if (query.includes('appointments_by_pk')) {
          if (faults.failRead) throw new Error('hasura down');
          return { appointments_by_pk: appt } as T;
        }
        throw new Error('unexpected query');
      },
    },
  };
}

export const participantEvent = (op: string, next: Record<string, unknown>, old: Record<string, unknown> | null = null) => ({
  event: { op, data: { old, new: next } },
  table: { schema: 'public', name: 'appointment_participants' },
  trigger: { name: 't' },
});
export const appointmentEvent = (old: Record<string, unknown>, next: Record<string, unknown>) => ({
  event: { op: 'UPDATE', data: { old, new: next } },
  table: { schema: 'public', name: 'appointments' },
  trigger: { name: 't' },
});
export const newParticipant = { appointment_id: 'a1', contact_id: 'c1', email_status: 'pending' };

export function run(hasura: ReturnType<typeof fakeHasura>, mailer: ReturnType<typeof fakeMailer>, body: unknown, headers: Record<string, string> = HEADERS) {
  return handleAppointmentEmail({ headers, body, env: ENV }, { client: hasura.client, mailer });
}
