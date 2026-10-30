#!/usr/bin/env node
// Manual check against Floci (not part of the test glob): does the whole staff activation flow work on the emulator?
// create as staff_pending -> password -> tokens -> enrol authenticator -> verify code -> role staff -> sign in asks for a code.
//   node scripts/staff-mfa-check.mjs
import { randomBytes, randomUUID } from 'node:crypto';
import { CLIENT_ID, POOL, cognito } from './cognito-env.mjs';
import { totp } from './totp.mjs';

const email = `spike-${randomBytes(4).toString('hex')}@example.test`;
const password = `Aa1!${randomBytes(12).toString('hex')}`;
let failed = false;

async function step(name, run) {
  try {
    const out = await run();
    console.log(`PASS ${name}`);
    return out;
  } catch (error) {
    failed = true;
    console.log(`FAIL ${name}: ${error.message}`);
    throw error;
  }
}

const claimsOf = (idToken) => JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));

try {
  await step('create user as staff_pending', async () => {
    await cognito('AdminCreateUser', {
      UserPoolId: POOL, Username: email, MessageAction: 'SUPPRESS', TemporaryPassword: `Tmp1!${randomBytes(10).toString('hex')}`,
      UserAttributes: [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }],
    }, { admin: true });
    await cognito('AdminUpdateUserAttributes', {
      UserPoolId: POOL, Username: email,
      UserAttributes: [{ Name: 'custom:role', Value: 'staff_pending' }, { Name: 'custom:org_id', Value: randomUUID() }],
    }, { admin: true });
  });
  await step('set the permanent password', () => cognito('AdminSetUserPassword', { UserPoolId: POOL, Username: email, Password: password, Permanent: true }, { admin: true }));
  const tokens = await step('sign in returns tokens before enrolment', async () => {
    const r = await cognito('InitiateAuth', { ClientId: CLIENT_ID, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password } });
    if (!r.AuthenticationResult) throw new Error(`got challenge ${r.ChallengeName}`);
    return r.AuthenticationResult;
  });
  const secret = await step('associate a software token', async () => {
    const r = await cognito('AssociateSoftwareToken', { AccessToken: tokens.AccessToken });
    if (!r.SecretCode) throw new Error('no secret code returned');
    return r.SecretCode;
  });
  await step('verify the first code', async () => {
    const r = await cognito('VerifySoftwareToken', { AccessToken: tokens.AccessToken, UserCode: totp(secret), FriendlyDeviceName: 'spike' });
    if (r.Status !== 'SUCCESS') throw new Error(`status ${r.Status}`);
  });
  await step('prefer the software token', () => cognito('SetUserMFAPreference', {
    AccessToken: tokens.AccessToken, SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true },
  }));
  await step('switch the role to staff', () => cognito('AdminUpdateUserAttributes', {
    UserPoolId: POOL, Username: email, UserAttributes: [{ Name: 'custom:role', Value: 'staff' }],
  }, { admin: true }));
  const challenge = await step('sign in now asks for the code', async () => {
    const r = await cognito('InitiateAuth', { ClientId: CLIENT_ID, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password } });
    if (r.ChallengeName !== 'SOFTWARE_TOKEN_MFA') throw new Error(`expected SOFTWARE_TOKEN_MFA, got ${r.ChallengeName ?? 'tokens'}`);
    return r;
  });
  await step('the code completes sign in with role staff', async () => {
    const r = await cognito('RespondToAuthChallenge', {
      ClientId: CLIENT_ID, ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: challenge.Session,
      ChallengeResponses: { USERNAME: challenge.ChallengeParameters.USER_ID_FOR_SRP, SOFTWARE_TOKEN_MFA_CODE: totp(secret, Math.floor(Date.now() / 1000) + 30) },
    });
    const role = claimsOf(r.AuthenticationResult.IdToken)['custom:role'];
    if (role !== 'staff') throw new Error(`token role is ${role}`);
  });
  await step('a wrong code is refused', async () => {
    const again = await cognito('InitiateAuth', { ClientId: CLIENT_ID, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password } });
    try {
      await cognito('RespondToAuthChallenge', {
        ClientId: CLIENT_ID, ChallengeName: 'SOFTWARE_TOKEN_MFA', Session: again.Session,
        ChallengeResponses: { USERNAME: again.ChallengeParameters.USER_ID_FOR_SRP, SOFTWARE_TOKEN_MFA_CODE: '000000' },
      });
    } catch {
      return;
    }
    throw new Error('wrong code was accepted');
  });
} catch {
  // the failing step already printed its line
} finally {
  await cognito('AdminDeleteUser', { UserPoolId: POOL, Username: email }, { admin: true }).catch(() => null);
}
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(failed ? 1 : 0);
