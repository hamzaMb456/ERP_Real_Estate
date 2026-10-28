import { NextResponse } from 'next/server';
import { CognitoError, clientId, cognito, toSession, userPoolId, type AuthenticationResult } from '@/lib/server/cognito';

type Body = Record<string, unknown>;

class InvalidRequest extends Error {}

function text(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value === '') throw new InvalidRequest();
  return value;
}

async function signIn(body: Body): Promise<Record<string, unknown>> {
  const email = text(body, 'email');
  const password = text(body, 'password');
  const result = await cognito<{ ChallengeName?: string; Session?: string; AuthenticationResult?: AuthenticationResult }>(
    'InitiateAuth',
    { ClientId: clientId(), AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password } },
  );
  if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED' && result.Session) {
    return { challenge: 'new-password', email, challengeSession: result.Session };
  }
  if (!result.AuthenticationResult) throw new CognitoError('NotAuthorizedException');
  return { session: toSession(result.AuthenticationResult) };
}

async function newPassword(body: Body): Promise<Record<string, unknown>> {
  const email = text(body, 'email');
  const newPassword = text(body, 'newPassword');
  const session = text(body, 'challengeSession');
  const result = await cognito<{ AuthenticationResult?: AuthenticationResult }>('RespondToAuthChallenge', {
    ClientId: clientId(),
    ChallengeName: 'NEW_PASSWORD_REQUIRED',
    Session: session,
    ChallengeResponses: { USERNAME: email, NEW_PASSWORD: newPassword },
  });
  if (!result.AuthenticationResult) throw new CognitoError('NotAuthorizedException');
  return { session: toSession(result.AuthenticationResult) };
}

async function signUp(body: Body): Promise<Record<string, unknown>> {
  const name = text(body, 'name');
  const email = text(body, 'email');
  const password = text(body, 'password');
  await cognito('SignUp', {
    ClientId: clientId(),
    Username: email,
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email }, { Name: 'name', Value: name }],
  });
  return { verify: true };
}

async function confirm(body: Body): Promise<Record<string, unknown>> {
  const email = text(body, 'email');
  const code = text(body, 'code');
  await cognito('ConfirmSignUp', { ClientId: clientId(), Username: email, ConfirmationCode: code });
  // Self sign-up creates a client account only. The role is set here on the server, never by the browser.
  await cognito('AdminUpdateUserAttributes', {
    UserPoolId: userPoolId(),
    Username: email,
    UserAttributes: [{ Name: 'custom:role', Value: 'client' }, { Name: 'custom:client', Value: 'true' }],
  }, { admin: true });
  return { ok: true };
}

async function forgot(body: Body): Promise<Record<string, unknown>> {
  const email = text(body, 'email');
  try {
    await cognito('ForgotPassword', { ClientId: clientId(), Username: email });
  } catch (error) {
    // Same answer whether or not the account exists, so this form cannot be used to probe addresses.
    if (!(error instanceof CognitoError) || error.code !== 'UserNotFoundException') throw error;
  }
  return { sent: true };
}

async function resetPassword(body: Body): Promise<Record<string, unknown>> {
  const email = text(body, 'email');
  const code = text(body, 'code');
  const newPassword = text(body, 'newPassword');
  await cognito('ConfirmForgotPassword', { ClientId: clientId(), Username: email, ConfirmationCode: code, Password: newPassword });
  return { ok: true };
}

async function refresh(body: Body): Promise<Record<string, unknown>> {
  const refreshToken = text(body, 'refreshToken');
  const result = await cognito<{ AuthenticationResult?: AuthenticationResult }>('InitiateAuth', {
    ClientId: clientId(),
    AuthFlow: 'REFRESH_TOKEN_AUTH',
    AuthParameters: { REFRESH_TOKEN: refreshToken },
  });
  if (!result.AuthenticationResult) throw new CognitoError('NotAuthorizedException');
  return { session: toSession(result.AuthenticationResult, refreshToken) };
}

async function signOut(body: Body): Promise<Record<string, unknown>> {
  await cognito('GlobalSignOut', { AccessToken: text(body, 'cognitoAccessToken') }).catch(() => null);
  return { ok: true };
}

const ACTIONS: Record<string, (body: Body) => Promise<Record<string, unknown>>> = {
  signin: signIn,
  newpassword: newPassword,
  signup: signUp,
  confirm,
  forgot,
  resetpassword: resetPassword,
  refresh,
  signout: signOut,
};

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Body | null;
  const action = typeof body?.action === 'string' ? ACTIONS[body.action] : undefined;
  if (!body || !action) return NextResponse.json({ error: 'invalid-request' }, { status: 400 });
  try {
    return NextResponse.json(await action(body));
  } catch (error) {
    if (error instanceof InvalidRequest) return NextResponse.json({ error: 'invalid-request' }, { status: 400 });
    if (error instanceof CognitoError) return NextResponse.json({ error: error.code }, { status: 400 });
    console.error('[auth] unexpected failure', error);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
