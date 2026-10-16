import { toast } from 'sonner';
import { getMessages } from '@/i18n/store';
import { isRetryable, toUserMessage } from '@/lib/errors';

/** Error toast with the sentence in the interface language; network and permission failures also get a retry button. */
export function showError(title: string, error: unknown, retry?: () => void): void {
  toast.error(title, {
    description: toUserMessage(error),
    action: retry && isRetryable(error) ? { label: getMessages().common.retry, onClick: retry } : undefined,
  });
}
