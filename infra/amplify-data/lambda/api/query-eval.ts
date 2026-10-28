// The small part of the row-query language the web sends as variables ($where, $orderBy...), evaluated
// in memory over rows already scoped to one organization. Lets resolvers answer the web's existing
// queries with the exact same result shape, so components do not change.
type Row = Record<string, unknown>;
export type Where = Record<string, unknown>;
export type OrderBy = Record<string, unknown> | Record<string, unknown>[];

const OPERATORS = new Set(['_eq', '_neq', '_in', '_nin', '_gt', '_gte', '_lt', '_lte', '_is_null', '_like', '_ilike', '_nlike', '_nilike']);

const isOperatorObject = (c: Record<string, unknown>): boolean => Object.keys(c).length > 0 && Object.keys(c).every((k) => OPERATORS.has(k));

function likeToRegex(pattern: string, flags: string): RegExp {
  const body = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${body}$`, flags);
}

const DATETIME = /^\d{4}-\d{2}-\d{2}T/;

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  // Timestamps arrive in several offsets ("Z", "+01:00"): compare them as instants.
  if (typeof a === 'string' && typeof b === 'string' && DATETIME.test(a) && DATETIME.test(b)) return Date.parse(a) - Date.parse(b);
  return String(a).localeCompare(String(b), 'fr');
}

/** SQL semantics: a comparison with NULL is never true (except _is_null). */
function compare(value: unknown, op: string, arg: unknown): boolean {
  if (op === '_is_null') return arg ? value == null : value != null;
  if (value == null) return false;
  switch (op) {
    case '_eq': return value === arg;
    case '_neq': return value !== arg;
    case '_in': return Array.isArray(arg) && arg.includes(value);
    case '_nin': return Array.isArray(arg) && !arg.includes(value);
    case '_gt': return compareValues(value, arg) > 0;
    case '_gte': return compareValues(value, arg) >= 0;
    case '_lt': return compareValues(value, arg) < 0;
    case '_lte': return compareValues(value, arg) <= 0;
    case '_like': return likeToRegex(String(arg), '').test(String(value));
    case '_ilike': return likeToRegex(String(arg), 'i').test(String(value));
    case '_nlike': return !likeToRegex(String(arg), '').test(String(value));
    case '_nilike': return !likeToRegex(String(arg), 'i').test(String(value));
    default: throw new Error(`unsupported_operator:${op}`);
  }
}

/** Row-filter expression: _and/_or/_not, column operators, and nested objects for relationships. */
export function matches(row: Row | undefined, where: Where | undefined | null): boolean {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === '_and') return (cond as Where[]).every((w) => matches(row, w));
    if (key === '_or') return (cond as Where[]).some((w) => matches(row, w));
    if (key === '_not') return !matches(row, cond as Where);
    const value = row?.[key];
    const c = (cond ?? {}) as Record<string, unknown>;
    const unknownOperator = Object.keys(c).find((k) => k.startsWith('_') && !OPERATORS.has(k));
    if (unknownOperator) throw new Error(`unsupported_operator:${unknownOperator}`);
    if (isOperatorObject(c)) return Object.entries(c).every(([op, arg]) => compare(value, op, arg));
    if (Array.isArray(value)) return value.some((v) => matches(v as Row, c));
    return value != null && typeof value === 'object' && matches(value as Row, c);
  });
}

type Direction = 'asc' | 'desc' | 'asc_nulls_first' | 'asc_nulls_last' | 'desc_nulls_first' | 'desc_nulls_last';

/** Flattens {a: 'asc'} / {rel: {b: 'desc'}} into [path, direction] pairs, in order. */
function orderTerms(orderBy: OrderBy): [string[], Direction][] {
  const terms: [string[], Direction][] = [];
  const walk = (obj: Record<string, unknown>, path: string[]) => {
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v === 'string') terms.push([[...path, k], v as Direction]);
      else if (v && typeof v === 'object') walk(v as Record<string, unknown>, [...path, k]);
    }
  };
  for (const o of Array.isArray(orderBy) ? orderBy : [orderBy]) walk(o, []);
  return terms;
}

const at = (row: Row, path: string[]): unknown => path.reduce<unknown>((v, k) => (v as Row | undefined)?.[k], row);

/** Postgres order: asc puts NULLs last, desc puts them first, unless told otherwise. */
export function sortRows<T extends Row>(rows: T[], orderBy: OrderBy | undefined | null): T[] {
  if (!orderBy) return rows;
  const terms = orderTerms(orderBy);
  return [...rows].sort((a, b) => {
    for (const [path, direction] of terms) {
      const desc = direction.startsWith('desc');
      const nullsFirst = direction.endsWith('nulls_first') || (direction === 'desc');
      const va = at(a, path);
      const vb = at(b, path);
      if (va == null || vb == null) {
        if (va == null && vb == null) continue;
        return (va == null) === nullsFirst ? -1 : 1;
      }
      const c = compareValues(va, vb);
      if (c !== 0) return desc ? -c : c;
    }
    return 0;
  });
}

export function page<T>(rows: T[], limit?: number | null, offset?: number | null): T[] {
  const start = Math.max(0, offset ?? 0);
  return limit == null ? rows.slice(start) : rows.slice(start, start + Math.max(0, limit));
}

/** distinct_on: the first row (in the current order) for each value of `field`. */
export function distinctOn<T extends Row>(rows: T[], field: string): T[] {
  const seen = new Set<unknown>();
  return rows.filter((r) => (seen.has(r[field]) ? false : (seen.add(r[field]), true)));
}

/** The value of a top-level `{ field: { _eq: value } }` term (directly or inside _and), if any. */
export function eqValue(where: Where | undefined | null, field: string): unknown {
  if (!where) return undefined;
  const direct = (where[field] as Record<string, unknown> | undefined)?._eq;
  if (direct !== undefined) return direct;
  for (const w of (where._and as Where[] | undefined) ?? []) {
    const nested = eqValue(w, field);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

export const aggregate = (count: number) => ({ aggregate: { count } });
