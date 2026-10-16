import { createHash, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_HEADER = 'x-nhost-webhook-secret';

type Headers = Record<string, string | string[] | undefined>;

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function headerValue(headers: Headers, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  const value = key === undefined ? undefined : headers[key];
  return typeof value === 'string' ? value : undefined;
}

/** Constant-time check of the webhook secret. A missing or empty expected secret never matches. */
export function isAuthorizedWebhook(headers: Headers, expected: string | undefined): boolean {
  if (!expected) return false;
  const received = headerValue(headers, WEBHOOK_HEADER);
  if (received === undefined) return false;
  // Hashing first gives equal-length buffers, so timingSafeEqual never throws and length leaks nothing.
  return timingSafeEqual(digest(received), digest(expected));
}
