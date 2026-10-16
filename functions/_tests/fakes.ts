import { vi } from 'vitest';
import type { MailMessage } from '../_lib/mailer';

/** A mailer whose send is a spy; pass an implementation to make it fail. */
export function fakeMailer(impl: (message: MailMessage) => Promise<void> = async () => undefined) {
  return { send: vi.fn<(message: MailMessage) => Promise<void>>(impl) };
}
