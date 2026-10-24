/**
 * A business-rule violation. `code` keeps the Postgres error codes and constraint names the
 * web already turns into sentences (web/src/lib/errors.ts), so the UI needs no change.
 */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function fail(code: string): never {
  throw new DomainError(code);
}
