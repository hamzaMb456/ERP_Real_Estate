import 'server-only';

// Cognito side of regional staff accounts. Admin calls run only here, on the server: the browser never holds admin rights.
// A staff login is `staff_pending` until the person finishes activation (password and authenticator code); the backend
// authorizer only accepts `staff`, so an unfinished or locked account cannot reach the API.

import { randomInt } from 'node:crypto';
import { CognitoError, cognito, userPoolId } from '@/lib/server/cognito';

export class StaffError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

type Attribute = { Name: string; Value: string };

const PENDING_ROLE = 'staff_pending';
const EMAIL_TAKEN = new Set(['UsernameExistsException', 'AliasExistsException']);
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*-_=+';

const pick = (alphabet: string): string => alphabet[randomInt(alphabet.length)];

/** A random password nobody sees: the person sets their own at activation. At least one of every character class. */
function throwawayPassword(): string {
  const all = LOWER + UPPER + DIGITS + SYMBOLS;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS), ...Array.from({ length: 20 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const admin = <T>(operation: string, body: Record<string, unknown>): Promise<T> =>
  cognito<T>(operation, { UserPoolId: userPoolId(), ...body }, { admin: true });

const setRole = (email: string, role: string): Promise<unknown> =>
  admin('AdminUpdateUserAttributes', { Username: email, UserAttributes: [{ Name: 'custom:role', Value: role }] });

/** Removes a login (used to undo a creation whose record could not be written). */
export async function deleteStaffLogin(email: string): Promise<void> {
  await admin('AdminDeleteUser', { Username: email });
}

/** The login of a new regional staff member: silent (no Cognito mail), random password, role staff_pending, org from the caller. */
export async function createStaffLogin(input: { email: string; name: string; orgId: string }): Promise<{ userId: string }> {
  let created: { User?: { Attributes?: Attribute[] } };
  try {
    created = await admin('AdminCreateUser', {
      Username: input.email,
      MessageAction: 'SUPPRESS',
      TemporaryPassword: throwawayPassword(),
      UserAttributes: [
        { Name: 'email', Value: input.email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: input.name },
      ],
    });
  } catch (error) {
    if (error instanceof CognitoError && EMAIL_TAKEN.has(error.code)) throw new StaffError('email_taken');
    throw error;
  }
  const userId = created.User?.Attributes?.find((attribute) => attribute.Name === 'sub')?.Value;
  try {
    if (!userId) throw new Error('Cognito returned no user id');
    await admin('AdminUpdateUserAttributes', {
      Username: input.email,
      UserAttributes: [{ Name: 'custom:role', Value: PENDING_ROLE }, { Name: 'custom:org_id', Value: input.orgId }],
    });
  } catch (error) {
    await deleteStaffLogin(input.email).catch(() => null);
    throw error;
  }
  return { userId };
}

/** Who a staff login must be before an admin action may touch it. */
export type StaffExpectation = { userId: string; orgId: string; roles: readonly string[] };

/**
 * Refuses to touch a Cognito login unless it really is a staff login of this organization: same user id, same
 * organization, role staff or staff_pending. Records in DynamoDB can be forged by a manager through the data relay, so
 * the login itself is the authority. Every failure looks the same (staff_not_found).
 */
export async function assertStaffLogin(email: string, expected: StaffExpectation): Promise<void> {
  let user: { UserAttributes?: Attribute[] };
  try {
    user = await admin('AdminGetUser', { Username: email });
  } catch (error) {
    if (error instanceof CognitoError && error.code === 'UserNotFoundException') throw new StaffError('staff_not_found');
    throw error;
  }
  const attribute = (name: string): string | undefined => user.UserAttributes?.find((a) => a.Name === name)?.Value;
  if (attribute('sub') !== expected.userId || attribute('custom:org_id') !== expected.orgId || !expected.roles.includes(attribute('custom:role') ?? '')) {
    throw new StaffError('staff_not_found');
  }
}

const ADMIN_TARGETS = ['staff', PENDING_ROLE] as const;

/** Kill switch, login side: disabled, every session signed out, role back to staff_pending. */
export async function lockStaffLogin(email: string, who: { userId: string; orgId: string }): Promise<void> {
  await assertStaffLogin(email, { ...who, roles: ADMIN_TARGETS });
  await admin('AdminDisableUser', { Username: email });
  await admin('AdminUserGlobalSignOut', { Username: email });
  await setRole(email, PENDING_ROLE);
}

/** Lost phone: the second step is cleared and open sessions end; the role waits for a new activation. */
export async function resetStaffAuthenticator(email: string, who: { userId: string; orgId: string }): Promise<void> {
  await assertStaffLogin(email, { ...who, roles: ADMIN_TARGETS });
  await admin('AdminSetUserMFAPreference', { Username: email, SoftwareTokenMfaSettings: { Enabled: false, PreferredMfa: false } });
  await admin('AdminUserGlobalSignOut', { Username: email });
  await setRole(email, PENDING_ROLE);
}
