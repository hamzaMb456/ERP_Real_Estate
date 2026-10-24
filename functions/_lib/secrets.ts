// Fetches the Hasura/SMTP/APP_URL config from AWS Secrets Manager, merged over plain Lambda env vars.
// NHOST_WEBHOOK_SECRET deliberately stays a plain Lambda env var, not in this secret: it's checked on
// every single request (isAuthorizedWebhook, before anything else runs), so a bad-auth request should
// reject cheaply without ever calling Secrets Manager. Only the config needed *after* auth passes
// (Hasura admin access, SMTP) is worth the extra API call and the "one secret, multiple functions,
// rotate without redeploying" benefit.
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import type { Env } from './runtime';

let cached: Env | null = null;

/** Lambda reuses a warm container across invocations; fetch the secret once per container, not per call. */
export async function resolveSecretEnv(env: Env): Promise<Env> {
  if (cached) return { ...env, ...cached };
  const secretName = env.SECRET_NAME;
  if (!secretName) throw new Error('SECRET_NAME not configured');

  const client = new SecretsManagerClient({
    endpoint: env.AWS_ENDPOINT_URL,
    region: env.AWS_REGION ?? 'us-east-1',
  });
  const response = await client.send(new GetSecretValueCommand({ SecretId: secretName }));
  if (!response.SecretString) throw new Error('secret has no SecretString');
  cached = JSON.parse(response.SecretString) as Env;
  return { ...env, ...cached };
}
