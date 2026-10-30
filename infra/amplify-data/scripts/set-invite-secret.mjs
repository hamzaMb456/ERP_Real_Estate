#!/usr/bin/env node
// Adds INVITE_SECRET to the Floci secret the functions already read (erp-functions-config). Prints only whether it
// changed, never a value. Existing links keep working unless --rotate is given.
// With --web the same value is also written to web/.env.local as STAFF_INVITE_SECRET: the web server needs it to prove
// that an authenticator code was verified (see api/staff/activate).
//   node scripts/set-invite-secret.mjs [--rotate] [--web]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withEnvLine, withInviteSecret } from './invite-secret.mjs';

const ENDPOINT = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
const SECRET_ID = process.env.ERP_SECRET_NAME ?? 'erp-functions-config';
const AUTH = 'AWS4-HMAC-SHA256 Credential=test/20260101/us-east-1/secretsmanager/aws4_request, SignedHeaders=host, Signature=x';

async function call(target, body) {
  const response = await fetch(`${ENDPOINT}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `secretsmanager.${target}`, Authorization: AUTH },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${target} ${(data.__type ?? 'error').split('#').pop()}`);
  return data;
}

try {
  const rotate = process.argv.includes('--rotate');
  const current = JSON.parse((await call('GetSecretValue', { SecretId: SECRET_ID })).SecretString ?? '{}');
  const next = withInviteSecret(current, undefined, { rotate });
  if (next.INVITE_SECRET === current.INVITE_SECRET) {
    console.log('INVITE_SECRET already set, left as it is');
  } else {
    await call('PutSecretValue', { SecretId: SECRET_ID, SecretString: JSON.stringify(next) });
    console.log(current.INVITE_SECRET ? 'INVITE_SECRET rotated' : 'INVITE_SECRET set');
  }
  if (process.argv.includes('--web')) {
    const envFile = join(import.meta.dirname, '..', '..', '..', 'web', '.env.local');
    const text = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
    writeFileSync(envFile, withEnvLine(text, 'STAFF_INVITE_SECRET', next.INVITE_SECRET));
    console.log('STAFF_INVITE_SECRET written to web/.env.local');
  }
} catch (error) {
  console.error(`FAILED ${error.message}`);
  process.exit(1);
}
