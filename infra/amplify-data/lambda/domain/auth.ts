import { fail } from './errors.ts';

/** The authorizer's resolverContext. */
export interface Caller {
  role: string;
  userId: string;
  orgId: string;
}

const WRITERS = new Set(['org_admin', 'manager']);

/** Roles that decide without asking anyone: whole-organization access, price and branch changes. */
export const MANAGER_ROLES = new Set(['org_admin', 'manager']);

/** Regional staff may also create and change records, inside their own branches (ops check the scope). */
const EDITORS = new Set([...WRITERS, 'staff']);

/** org_admin / manager of an organization (lease_session_org). Returns the org id. */
export function requireWriter(caller: Caller, code = 'forbidden'): string {
  if (!caller.orgId || !WRITERS.has(caller.role)) fail(code);
  return caller.orgId;
}

/** Manager or regional staff of an organization. Only for operations whose ops layer checks the branch scope. */
export function requireEditor(caller: Caller, code = 'forbidden'): string {
  if (!caller.orgId || !EDITORS.has(caller.role)) fail(code);
  return caller.orgId;
}
