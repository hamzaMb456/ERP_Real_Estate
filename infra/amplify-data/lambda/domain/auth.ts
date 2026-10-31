import { fail } from './errors.ts';

/** The authorizer's resolverContext. */
export interface Caller {
  role: string;
  userId: string;
  orgId: string;
}

const WRITERS = new Set(['org_admin', 'manager']);

/** Roles that decide without asking anyone: price and branch changes. */
export const MANAGER_ROLES = new Set(['org_admin', 'manager']);

/** org_admin / manager of an organization (lease_session_org). Returns the org id. */
export function requireWriter(caller: Caller, code = 'forbidden'): string {
  if (!caller.orgId || !WRITERS.has(caller.role)) fail(code);
  return caller.orgId;
}
