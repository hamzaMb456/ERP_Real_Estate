'use client';

import { useT } from '@/i18n/provider';

export type ActivityRow = {
  id: string;
  user_id: string;
  kind: string;
  actor_user_id: string;
  created_at: string;
  detail: string | null;
};

/** The trail of staff accounts, newest first: what happened, to whom, by whom, when. */
export function StaffActivity({ rows, names }: { rows: ActivityRow[]; names: Record<string, string> }) {
  const f = useT().properties.branchForm;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{f.noActivity}</p>;
  const who = (id: string): string => names[id] ?? '';

  return (
    <ul className="divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3 text-sm">
          <span>
            <span className="font-medium">{f.activity[row.kind as keyof typeof f.activity] ?? row.kind}</span>
            {who(row.user_id) ? ` · ${who(row.user_id)}` : ''}
            {row.actor_user_id !== row.user_id && who(row.actor_user_id) ? ` (${who(row.actor_user_id)})` : ''}
          </span>
          <time className="text-xs text-muted-foreground" dateTime={row.created_at}>
            {new Date(row.created_at).toLocaleString()}
          </time>
        </li>
      ))}
    </ul>
  );
}
