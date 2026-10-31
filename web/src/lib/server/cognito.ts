import 'server-only';
import type { AuthSession } from '@/lib/auth/types';

export type AuthenticationResult = {
  IdToken: string;
  AccessToken: string;
  RefreshToken?: string;
  ExpiresIn: number;
};

export class CognitoError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const ADMIN_AUTH_HEADER = 'AWS4-HMAC-SHA256 Credential=test/00000000/us-east-1/cognito-idp/aws4_request, SignedHeaders=host, Signature=x';

/** Calls one Cognito operation. Admin operations need the pool id; public ones need none. */
export async function cognito<T>(operation: string, body: Record<string, unknown>, options: { admin?: boolean } = {}): Promise<T> {
  const response = await fetch(requiredEnv('AUTH_COGNITO_URL'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${operation}`,
      ...(options.admin ? { Authorization: ADMIN_AUTH_HEADER } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const data = (await response.json().catch(() => ({}))) as { __type?: string };
  if (!response.ok) throw new CognitoError((data.__type ?? 'UnknownError').split('#').pop() ?? 'UnknownError');
  return data as T;
}

export function clientId(): string {
  return requiredEnv('AUTH_CLIENT_ID');
}

export function userPoolId(): string {
  return requiredEnv('AUTH_USER_POOL_ID');
}

function claimsOf(idToken: string): Record<string, unknown> {
  const payload = idToken.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

/** Builds the browser session from a Cognito result. An ERP role keeps its name; a client account becomes "user". */
export function toSession(result: AuthenticationResult, previousRefreshToken?: string): AuthSession {
  const claims = claimsOf(result.IdToken);
  const role = claims['custom:role'];
  const defaultRole = role === 'client' ? 'user' : typeof role === 'string' ? role : '';
  const email = typeof claims.email === 'string' ? claims.email : '';
  return {
    accessToken: result.IdToken,
    cognitoAccessToken: result.AccessToken,
    refreshToken: result.RefreshToken ?? previousRefreshToken ?? '',
    expiresAt: Date.now() + result.ExpiresIn * 1000,
    user: {
      id: typeof claims.sub === 'string' ? claims.sub : '',
      email,
      displayName: typeof claims.name === 'string' && claims.name ? claims.name : email,
      defaultRole,
    },
  };
}
