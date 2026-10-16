/** Hasura event trigger body, as Nhost passes it to a function. */
export type HasuraEvent = {
  event: {
    op: 'INSERT' | 'UPDATE' | 'DELETE' | 'MANUAL';
    data: { old: Record<string, unknown> | null; new: Record<string, unknown> | null };
  };
  table: { schema: string; name: string };
  trigger: { name: string };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrows an unknown request body to an event; returns null when the shape is wrong. */
export function parseEvent(body: unknown): HasuraEvent | null {
  if (!isRecord(body) || !isRecord(body.event)) return null;
  const { op, data } = body.event;
  if (typeof op !== 'string' || !isRecord(data)) return null;
  const table = isRecord(body.table) ? body.table : {};
  const trigger = isRecord(body.trigger) ? body.trigger : {};
  return {
    event: {
      op: op as HasuraEvent['event']['op'],
      data: {
        old: isRecord(data.old) ? data.old : null,
        new: isRecord(data.new) ? data.new : null,
      },
    },
    table: { schema: String(table.schema ?? ''), name: String(table.name ?? '') },
    trigger: { name: String(trigger.name ?? '') },
  };
}
