// Pure helpers for the invitation signing secret kept in the same Secrets Manager secret as the SMTP settings.
import { randomBytes } from 'node:crypto';

/** 48 random bytes as base64url: long enough that guessing it is out of the question. */
export function generateInviteSecret() {
  return randomBytes(48).toString('base64url');
}

/**
 * The secret document with INVITE_SECRET present. An existing value is kept (links already emailed keep working)
 * unless `rotate` is set. The input object is not changed.
 */
export function withInviteSecret(current, generate = generateInviteSecret, { rotate = false } = {}) {
  if (current.INVITE_SECRET && !rotate) return { ...current };
  return { ...current, INVITE_SECRET: generate() };
}

/** An env file's text with NAME=value added at the end, or replaced where NAME already is. Other lines and the line endings stay. */
export function withEnvLine(text, name, value) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  const index = lines.findIndex((line) => line.startsWith(`${name}=`));
  if (index >= 0) lines[index] = `${name}=${value}`;
  else lines.push(`${name}=${value}`);
  return lines.join(eol) + eol;
}
