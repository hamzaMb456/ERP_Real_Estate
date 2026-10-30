#!/usr/bin/env node
// Turns on the authenticator-app (software token) second step on the Cognito pool, as OPTIONAL: only users who enrol are
// asked for a code. Staff are forced to enrol by the activation flow, not by the pool. Safe to run again.
//   node scripts/enable-pool-mfa.mjs
import { POOL, cognito } from './cognito-env.mjs';

try {
  await cognito('SetUserPoolMfaConfig', {
    UserPoolId: POOL,
    MfaConfiguration: 'OPTIONAL',
    SoftwareTokenMfaConfiguration: { Enabled: true },
  }, { admin: true });
  const now = await cognito('GetUserPoolMfaConfig', { UserPoolId: POOL }, { admin: true });
  console.log(`OK pool MFA: ${now.MfaConfiguration}, software token: ${now.SoftwareTokenMfaConfiguration?.Enabled}`);
} catch (error) {
  console.error(`FAILED ${error.message}`);
  process.exit(1);
}
