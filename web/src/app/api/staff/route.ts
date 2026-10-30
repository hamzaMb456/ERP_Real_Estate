import { NextResponse } from 'next/server';
import { appsyncRequest } from '@/lib/backend';
import { requireManager, requireSession, type SessionClaims } from '@/lib/server/auth';
import { CognitoError } from '@/lib/server/cognito';
import {
  StaffError,
  createStaffLogin,
  deleteStaffLogin,
  lockStaffLogin,
  resetStaffAuthenticator,
} from '@/lib/server/staff-accounts';

// Manager actions on regional staff accounts: create, resend, disable (kill switch), reset the authenticator.
// The Cognito username always comes from a record found in the caller's organization, never from the request.

type Body = Record<string, unknown>;

class InvalidRequest extends Error {}

function text(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') throw new InvalidRequest();
  return value.trim();
}

const CREATE_STAFF_RECORD = `
  mutation CreateStaffRecord($user_id: ID!, $email: String!, $display_name: String!, $branch_ids: [ID!]!) {
    create_staff(user_id: $user_id, email: $email, display_name: $display_name, branch_ids: $branch_ids) { invitation_id }
  }
`;
const RESEND = `mutation ResendStaffInvitation($user_id: ID!) { resend_staff_invitation(user_id: $user_id) { invitation_id } }`;
const RESET = `mutation ResetStaffMfa($user_id: ID!) { reset_staff_mfa(user_id: $user_id) { invitation_id } }`;
const OFFBOARD = `mutation OffboardStaff($user_id: ID!) { offboard_staff(user_id: $user_id) { user_id } }`;
const LOOKUP = `query StaffMemberLookup($user_id: ID!) { staff_member(user_id: $user_id) { user_id email display_name } }`;

async function memberEmail(session: SessionClaims, userId: string): Promise<string> {
  const found = await appsyncRequest<{ staff_member: { email: string } }>(LOOKUP, { user_id: userId }, session.token);
  return found.staff_member.email;
}

async function create(session: SessionClaims, body: Body): Promise<Record<string, unknown>> {
  const email = text(body, 'email').toLowerCase();
  const name = text(body, 'name');
  const branchIds = Array.isArray(body.branchIds) ? body.branchIds.filter((id): id is string => typeof id === 'string') : [];
  const { userId } = await createStaffLogin({ email, name, orgId: session.orgId });
  try {
    await appsyncRequest(CREATE_STAFF_RECORD, { user_id: userId, email, display_name: name, branch_ids: branchIds }, session.token);
  } catch (error) {
    await deleteStaffLogin(email).catch(() => null);
    throw error;
  }
  return { ok: true, userId };
}

async function resend(session: SessionClaims, body: Body): Promise<Record<string, unknown>> {
  await appsyncRequest(RESEND, { user_id: text(body, 'userId') }, session.token);
  return { ok: true };
}

async function disable(session: SessionClaims, body: Body): Promise<Record<string, unknown>> {
  const userId = text(body, 'userId');
  await lockStaffLogin(await memberEmail(session, userId), { userId, orgId: session.orgId });
  await appsyncRequest(OFFBOARD, { user_id: userId }, session.token);
  return { ok: true };
}

async function resetMfa(session: SessionClaims, body: Body): Promise<Record<string, unknown>> {
  const userId = text(body, 'userId');
  await resetStaffAuthenticator(await memberEmail(session, userId), { userId, orgId: session.orgId });
  await appsyncRequest(RESET, { user_id: userId }, session.token);
  return { ok: true };
}

const ACTIONS: Record<string, (session: SessionClaims, body: Body) => Promise<Record<string, unknown>>> = {
  create,
  resend,
  disable,
  resetmfa: resetMfa,
};

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Body | null;
  const action = body && typeof body.action === 'string' ? ACTIONS[body.action] : undefined;
  if (!body || !action) return NextResponse.json({ error: 'invalid-request' }, { status: 400 });

  let session: SessionClaims;
  try {
    session = await requireSession(request.headers.get('authorization'));
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    requireManager(session);
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  try {
    return NextResponse.json(await action(session, body));
  } catch (error) {
    if (error instanceof InvalidRequest) return NextResponse.json({ error: 'invalid-request' }, { status: 400 });
    if (error instanceof StaffError) return NextResponse.json({ error: error.code }, { status: error.code === 'email_taken' ? 409 : 400 });
    if (error instanceof CognitoError) return NextResponse.json({ error: error.code }, { status: 400 });
    if (error instanceof Error && /^[a-z_]+$/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('[staff] unexpected failure', error);
    return NextResponse.json({ error: 'server-error' }, { status: 500 });
  }
}
