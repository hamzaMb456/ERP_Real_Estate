// Every operation the web sends, by its GraphQL operation name. Each returns the same JSON shape the
// web's query returned, so a component switches backend without changing.
import type { Caller } from '../domain/auth.ts';

export type Vars = Record<string, unknown>;

export interface Op {
  kind: 'query' | 'mutation';
  roles: readonly string[];
  run(caller: Caller, vars: Vars): Promise<unknown>;
}

/** Everyone who works in the ERP: reads the whole organization. Default-deny: ops list the roles they accept. */
export const ORG_USERS = ['org_admin', 'manager', 'viewer'] as const;
/** Everyone who writes in the ERP. */
export const WRITERS = ['org_admin', 'manager'] as const;
export const CLIENT = ['user'] as const;
export const ANYONE = ['public', 'user', ...ORG_USERS] as const;

export const query = (roles: readonly string[], run: Op['run']): Op => ({ kind: 'query', roles, run });
export const mutation = (roles: readonly string[], run: Op['run']): Op => ({ kind: 'mutation', roles, run });
