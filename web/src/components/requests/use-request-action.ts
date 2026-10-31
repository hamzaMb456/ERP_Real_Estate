'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { showError } from '@/lib/show-error';

const TONES: Record<string, string> = {
  new: 'bg-warning/15 text-warning',
  contacted: 'bg-info/10 text-info',
  accepted: 'bg-success/10 text-success',
  confirmed: 'bg-success/10 text-success',
  declined: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-destructive/10 text-destructive',
  done: 'bg-muted text-muted-foreground',
  closed: 'bg-muted text-muted-foreground',
};

/** Badge colours of a request status. */
export const requestTone = (status: string): string => TONES[status] ?? TONES.closed;

/**
 * Runs one team action on a request: marks that request busy (its buttons disable), toasts the result and reloads the
 * list. `describeError` lets a page word a known failure itself (a slot already taken); anything else goes through showError.
 */
export function useRequestAction(reload: () => void, failTitle: string, describeError?: (error: unknown) => string | null) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = useCallback(
    async (id: string, action: () => Promise<unknown>, success: string) => {
      // A function declaration, so the retry button of the error toast can start the same attempt again.
      async function attempt(): Promise<void> {
        setBusyId(id);
        try {
          await action();
          toast.success(success);
          reload();
        } catch (error) {
          const known = describeError?.(error) ?? null;
          if (known !== null) toast.error(failTitle, { description: known });
          else showError(failTitle, error, () => void attempt());
        } finally {
          setBusyId(null);
        }
      }
      await attempt();
    },
    [reload, failTitle, describeError],
  );

  return { busyId, run };
}
