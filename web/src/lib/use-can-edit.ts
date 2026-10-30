'use client';

import { useAuth } from '@/components/auth-provider';

const WRITER_ROLES = new Set(['org_admin', 'manager', 'staff']);
const MANAGER_ROLES = new Set(['org_admin', 'manager']);

/** True when the signed-in user's role may create and change records (viewers read only; staff only inside their branches, which the backend checks). */
export function useCanEdit(): boolean {
  const { session } = useAuth();
  return WRITER_ROLES.has(session?.user?.defaultRole ?? '');
}

/** True for the manager and org_admin: deletions and price, fee and deposit changes. */
export function useCanManage(): boolean {
  const { session } = useAuth();
  return MANAGER_ROLES.has(session?.user?.defaultRole ?? '');
}
