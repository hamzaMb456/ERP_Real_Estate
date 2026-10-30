// Cognito settings for the local scripts: the same values the web app uses (web/.env.local), read without printing them.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ADMIN_HEADER = 'AWS4-HMAC-SHA256 Credential=test/00000000/us-east-1/cognito-idp/aws4_request, SignedHeaders=host, Signature=x';

function readEnvFile() {
  const text = readFileSync(join(import.meta.dirname, '..', '..', '..', 'web', '.env.local'), 'utf8');
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

const env = readEnvFile();
for (const name of ['AUTH_COGNITO_URL', 'AUTH_USER_POOL_ID', 'AUTH_CLIENT_ID']) {
  if (!env[name]) throw new Error(`${name} is missing from web/.env.local`);
}

export const COGNITO_URL = env.AUTH_COGNITO_URL;
export const POOL = env.AUTH_USER_POOL_ID;
export const CLIENT_ID = env.AUTH_CLIENT_ID;

/** One Cognito call. Admin calls carry the fixed local header; others are public. Throws "<op> <code>" on failure. */
export async function cognito(operation, body, { admin = false } = {}) {
  const response = await fetch(COGNITO_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${operation}`,
      ...(admin ? { Authorization: ADMIN_HEADER } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${operation} ${(data.__type ?? 'UnknownError').split('#').pop()}`);
  return data;
}
