// Every operation the web sends, by its GraphQL operation name. Each returns the same JSON shape the
// web's query returned, so a component switches backend without changing.
import type { Caller } from '../domain/auth.ts';

export type Vars = Record<string, unknown>;

export interface Op {
  kind: 'query' | 'mutation';
  roles: readonly string[];
  run(caller: Caller, vars: Vars): Promise<unknown>;
}

export const STAFF = ['org_admin', 'manager', 'viewer'] as const;
export const WRITERS = ['org_admin', 'manager'] as const;
export const CLIENT = ['user'] as const;
export const ANYONE = ['public', 'user', ...STAFF] as const;
/** Regional staff: sees and works only in the branches assigned to them (see domain/scope.ts). Default-deny: ops list it explicitly. */
export const REGIONAL = ['staff', ...STAFF] as const;
/** Writes a regional staff member may make inside their branches (ops check the scope and the price rules). */
export const EDITORS = ['staff', 'org_admin', 'manager'] as const;

export const query = (roles: readonly string[], run: Op['run']): Op => ({ kind: 'query', roles, run });
export const mutation = (roles: readonly string[], run: Op['run']): Op => ({ kind: 'mutation', roles, run });
