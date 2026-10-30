import type { Caller } from '../domain/auth.ts';
import { fail } from '../domain/errors.ts';
import { assertActiveStaff } from '../domain/staff-accounts.ts';
import { OPS } from './ops/index.ts';
import type { Op, Vars } from './registry.ts';

export interface AppSyncArgs {
  op?: string;
  /** AWSJSON: a JSON string (or, depending on the runtime, already parsed). */
  variables?: string | Vars | null;
}

const FIELD_KIND: Record<string, Op['kind']> = { run: 'query', exec: 'mutation' };

function parseVariables(raw: AppSyncArgs['variables']): Vars {
  if (raw == null || raw === '') return {};
  if (typeof raw === 'string') return JSON.parse(raw) as Vars;
  return raw;
}

/** run(op, variables) / exec(op, variables): find the operation, check kind and role, run it. */
export async function dispatch(
  fieldName: string,
  args: AppSyncArgs,
  caller: Caller,
  ops: Record<string, Op> = OPS,
  activeStaff: (caller: Caller) => Promise<void> = assertActiveStaff,
): Promise<string> {
  const kind = FIELD_KIND[fieldName];
  if (!kind) throw new Error(`Unknown field ${fieldName}`);
  const name = args.op ?? '';
  const op = ops[name];
  if (!op || op.kind !== kind) fail(`unknown_operation:${name}`);
  if (!op.roles.includes(caller.role)) fail('permission_denied');
  // A disabled staff member keeps a valid token for a while: the account itself is checked on every call.
  if (caller.role === 'staff') await activeStaff(caller);
  return JSON.stringify(await op.run(caller, parseVariables(args.variables)));
}
