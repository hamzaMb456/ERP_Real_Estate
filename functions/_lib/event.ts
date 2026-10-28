/** Row-change event body: what a table change handler receives (op, old row, new row, table, trigger). */
export type RowChangeEvent = {
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
export function parseEvent(body: unknown): RowChangeEvent | null {
  if (!isRecord(body) || !isRecord(body.event)) return null;
  const { op, data } = body.event;
  if (typeof op !== 'string' || !isRecord(data)) return null;
  const table = isRecord(body.table) ? body.table : {};
  const trigger = isRecord(body.trigger) ? body.trigger : {};
  return {
    event: {
      op: op as RowChangeEvent['event']['op'],
      data: {
        old: isRecord(data.old) ? data.old : null,
        new: isRecord(data.new) ? data.new : null,
      },
    },
    table: { schema: String(table.schema ?? ''), name: String(table.name ?? '') },
    trigger: { name: String(trigger.name ?? '') },
  };
}
