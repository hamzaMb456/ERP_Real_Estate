// Single resolver Lambda: whoami, plus run (queries) / exec (mutations) by GraphQL operation name.
import type { Caller } from '../domain/auth.ts';
import { DomainError } from '../domain/errors.ts';
import type { AppSyncArgs } from './dispatch.ts';
import { dispatch } from './dispatch.ts';

type AppSyncEvent = {
  fieldName: string;
  arguments?: AppSyncArgs;
  identity?: { resolverContext?: Record<string, string> };
};

function callerOf(event: AppSyncEvent): Caller {
  const ctx = event.identity?.resolverContext ?? {};
  return { role: ctx.role ?? '', userId: ctx.userId ?? '', orgId: ctx.orgId ?? '' };
}

/**
 * The Lambda runtime sends a thrown Error to the caller as { errorType, errorMessage, trace }, and AppSync
 * forwards it. Only the code may leave: a business-rule error keeps its code, anything else becomes
 * `internal_error` (the original stays in the function log) and neither carries stack frames or file paths.
 */
function forCaller(err: unknown): Error {
  const known = err instanceof DomainError;
  if (!known) console.error('unexpected error in api resolver:', err);
  const safe = new Error(known ? err.message : 'internal_error');
  safe.name = known ? err.name : 'InternalError';
  safe.stack = `${safe.name}: ${safe.message}`;
  return safe;
}

export const handler = async (event: AppSyncEvent) => {
  const caller = callerOf(event);
  if (event.fieldName === 'whoami') return `${caller.role}:${caller.orgId}`;
  try {
    return await dispatch(event.fieldName, event.arguments ?? {}, caller);
  } catch (err) {
    throw forCaller(err);
  }
};
