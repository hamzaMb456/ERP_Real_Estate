import { graphql } from '@/lib/graphql';

// The data layer only lets a user read and update (read_at only) the notifications of their own organization.
export const NOTIFICATIONS_QUERY = `
  query Notifications {
    notifications(order_by: { created_at: desc }, limit: 20) {
      id
      kind
      title
      link
      lease_id
      appointment_id
      read_at
      created_at
    }
    notifications_aggregate(where: { read_at: { _is_null: true } }) { aggregate { count } }
  }
`;

const MARK_ALL_READ = `
  mutation MarkAllNotificationsRead($now: timestamptz!) {
    update_notifications(where: { read_at: { _is_null: true } }, _set: { read_at: $now }) { affected_rows }
  }
`;

const MARK_READ = `
  mutation MarkNotificationRead($id: uuid!, $now: timestamptz!) {
    update_notifications_by_pk(pk_columns: { id: $id }, _set: { read_at: $now }) { id }
  }
`;

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  link: string | null;
  lease_id: string | null;
  appointment_id: string | null;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsData {
  notifications: NotificationRow[];
  notifications_aggregate: { aggregate: { count: number } };
}

export async function markAllNotificationsRead(): Promise<void> {
  await graphql(MARK_ALL_READ, { now: new Date().toISOString() });
}

export async function markNotificationRead(id: string): Promise<void> {
  await graphql(MARK_READ, { id, now: new Date().toISOString() });
}
