'use client';

import { useAuth } from '@/components/auth-provider';

const WRITER_ROLES = new Set(['org_admin', 'manager']);

/** True when the signed-in user's role may create and change records (viewers read only). */
export function useCanEdit(): boolean {
  const { session } = useAuth();
  return WRITER_ROLES.has(session?.user?.defaultRole ?? '');
}
