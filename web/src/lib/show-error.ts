import { toast } from 'sonner';
import { isRetryable, toFrenchError } from '@/lib/errors';

/** Error toast with the French sentence; network and permission failures also get « Réessayer ». */
export function showError(title: string, error: unknown, retry?: () => void): void {
  toast.error(title, {
    description: toFrenchError(error),
    action: retry && isRetryable(error) ? { label: 'Réessayer', onClick: retry } : undefined,
  });
}
