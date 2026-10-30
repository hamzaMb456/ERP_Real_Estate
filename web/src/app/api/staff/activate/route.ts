import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { CognitoError, cognito, clientId, userPoolId, type AuthenticationResult } from '@/lib/server/cognito';
import { StaffError, assertStaffLogin } from '@/lib/server/staff-accounts';
import { publicQuery } from '@/lib/site/public-api';

// Activation of a regional staff account from the emailed link: choose a password, enrol the authenticator app, done.
// Every step re-checks the link with the backend; a failed check answers the same error whatever the reason.
// The role only becomes `staff` after a verified authenticator code, and the access token used for enrolment must belong
// to the invited user (checked with Cognito), so a link cannot be used to activate someone else's account.

type Body = Record<string, unknown>;
type Invitation = { ok: true; user_id: string; organization_id: string; email: string; display_name: string } | { ok: false };

class InvalidRequest extends Error {}
class InvalidInvitation extends Error {}
class InvalidPassword extends Error {}
class InvalidCode extends Error {}

const CHECK = `query StaffInvitationCheck($token: String!) { staff_invitation(token: $token) { ok user_id email display_name } }`;
const CONFIRM = `mutation ConfirmStaffActivation($token: String!, $proof: String!) { confirm_staff_activation(token: $token, proof: $proof) { ok } }`;
const WRONG_CODE = new Set(['EnableSoftwareTokenMFAException', 'CodeMismatchException']);

function text(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value === '') throw new InvalidRequest();
  return value;
}

async function invitationOf(token: string): Promise<Extract<Invitation, { ok: true }>> {
  const found = await publicQuery<{ staff_invitation: Invitation }>(CHECK, { token });
  if (!found.staff_invitation?.ok) throw new InvalidInvitation();
  return found.staff_invitation;
}

/** The link only ever acts on the pending staff login it was made for: same user, same organization, role staff_pending. */
async function assertPendingLogin(invitation: Extract<Invitation, { ok: true }>): Promise<void> {
  await assertStaffLogin(invitation.email, { userId: invitation.user_id, orgId: invitation.organization_id, roles: ['staff_pending'] });
}

async function check(body: Body): Promise<Record<string, unknown>> {
  const invitation = await invitationOf(text(body, 'token'));
  return { email: invitation.email, name: invitation.display_name };
}

async function setPassword(body: Body): Promise<Record<string, unknown>> {
  const invitation = await invitationOf(text(body, 'token'));
  const password = text(body, 'password');
  await assertPendingLogin(invitation);
  try {
    await cognito('AdminSetUserPassword', { UserPoolId: userPoolId(), Username: invitation.email, Password: password, Permanent: true }, { admin: true });
  } catch (error) {
    if (error instanceof CognitoError && error.code === 'InvalidPasswordException') throw new InvalidPassword();
    throw error;
  }
  const signedIn = await cognito<{ AuthenticationResult?: AuthenticationResult }>('InitiateAuth', {
    ClientId: clientId(),
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: invitation.email, PASSWORD: password },
  });
  const accessToken = signedIn.AuthenticationResult?.AccessToken;
  if (!accessToken) throw new CognitoError('NotAuthorizedException');
  const { SecretCode: setupKey } = await cognito<{ SecretCode: string }>('AssociateSoftwareToken', { AccessToken: accessToken });
  const label = encodeURIComponent(`ERP:${invitation.email}`);
  return { setupKey, otpauthUrl: `otpauth://totp/${label}?secret=${setupKey}&issuer=ERP`, accessToken };
}

/**
 * The proof that this server verified the authenticator code. Only the servers hold the secret, so holding the link alone
 * cannot confirm an activation. A missing secret stops the step before anything is changed.
 */
function confirmationProofFor(token: string): string {
  const secret = process.env.STAFF_INVITE_SECRET;
  if (!secret) throw new Error('STAFF_INVITE_SECRET is not set');
  return createHmac('sha256', secret).update(`confirm.${token.split('.')[0]}`).digest('hex');
}

async function verify(body: Body): Promise<Record<string, unknown>> {
  const token = text(body, 'token');
  const proof = confirmationProofFor(token);
  const code = text(body, 'code');
  const accessToken = text(body, 'accessToken');
  const invitation = await invitationOf(token);
  await assertPendingLogin(invitation);

  // The enrolment token must be the invited user's own.
  const who = await cognito<{ UserAttributes?: { Name: string; Value: string }[] }>('GetUser', { AccessToken: accessToken });
  if (who.UserAttributes?.find((a) => a.Name === 'sub')?.Value !== invitation.user_id) throw new InvalidInvitation();

  try {
    const verified = await cognito<{ Status?: string }>('VerifySoftwareToken', { AccessToken: accessToken, UserCode: code, FriendlyDeviceName: 'Authenticator' });
    if (verified.Status !== 'SUCCESS') throw new InvalidCode();
  } catch (error) {
    if (error instanceof CognitoError && WRONG_CODE.has(error.code)) throw new InvalidCode();
    throw error;
  }
  await cognito('SetUserMFAPreference', { AccessToken: accessToken, SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true } });
  await cognito('AdminUpdateUserAttributes', {
    UserPoolId: userPoolId(),
    Username: invitation.email,
    UserAttributes: [{ Name: 'custom:role', Value: 'staff' }],
  }, { admin: true });
  await publicQuery(CONFIRM, { token, proof });
  return { ok: true };
}

const ACTIONS: Record<string, (body: Body) => Promise<Record<string, unknown>>> = { check, setpassword: setPassword, verify };

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Body | null;
  const action = body && typeof body.action === 'string' ? ACTIONS[body.action] : undefined;
  if (!body || !action) return NextResponse.json({ error: 'invalid-request' }, { status: 400 });
  try {
    return NextResponse.json(await action(body));
  } catch (error) {
    if (error instanceof InvalidRequest) return NextResponse.json({ error: 'invalid-request' }, { status: 400 });
    if (error instanceof InvalidInvitation || error instanceof StaffError) return NextResponse.json({ error: 'invalid-invitation' }, { status: 400 });
    if (error instanceof InvalidPassword) return NextResponse.json({ error: 'invalid-password' }, { status: 400 });
    if (error instanceof InvalidCode) return NextResponse.json({ error: 'invalid-code' }, { status: 400 });
    if (error instanceof CognitoError) return NextResponse.json({ error: 'activation-failed' }, { status: 400 });
    console.error('[staff-activate] unexpected failure', error);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
