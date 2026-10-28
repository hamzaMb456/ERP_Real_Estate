// Maintenance switch: NEXT_PUBLIC_WRITE_FREEZE=on makes every GraphQL mutation and storage upload fail
// with "write_frozen" while reads keep working. Used for the database cutover window.

export const WRITE_FROZEN = 'write_frozen';

const MUTATION = /^\s*mutation\b/;

export function writesFrozen(): boolean {
  return process.env.NEXT_PUBLIC_WRITE_FREEZE === 'on';
}

export function assertWritable(query: string): void {
  if (writesFrozen() && MUTATION.test(query)) throw new Error(WRITE_FROZEN);
}
