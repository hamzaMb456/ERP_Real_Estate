#!/usr/bin/env node
// Creates TWO real agencies on the dev stack so multi-organization separation can be
// tested by hand in the ERP UI (not the automated way of two-org-isolation.int.test.ts).
//   node scripts/two-org-demo.mjs
// For each agency: an Organization row + branch, property, units, contacts in DynamoDB,
// and a real Cognito account (org_admin, custom:org_id set server-side). Prints credentials.
// NOTE: the dev Floci container runs in memory storage mode by default — a restart loses these.
import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

process.env.AWS_ENDPOINT_URL ??= 'http://localhost:4566';
process.env.AWS_REGION ??= 'us-east-1';
process.env.AWS_ACCESS_KEY_ID ??= 'test';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test';

const COGNITO_URL = 'http://localhost:4566/';
const POOL = 'us-east-1_dadf1b949';
const CLIENT_ID = '5d3304e471c84a21bd5326c412';
const ADMIN_HEADER = 'AWS4-HMAC-SHA256 Credential=test/00000000/us-east-1/cognito-idp/aws4_request, SignedHeaders=host, Signature=x';

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const table = (model) => `${model}-861df1f5118d47acb3576c3db2-NONE`;
const put = (Model, item) =>
  doc.send(new PutCommand({ TableName: table(Model), Item: { __typename: Model, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...item } }));

async function cognito(op, body) {
  const r = await fetch(COGNITO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityProviderService.${op}`, Authorization: ADMIN_HEADER },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${op} ${r.status} ${JSON.stringify(data)}`);
  return data;
}

async function createAdminAccount(email, password, name, orgId) {
  await cognito('AdminCreateUser', {
    UserPoolId: POOL, Username: email, MessageAction: 'SUPPRESS', TemporaryPassword: password,
    UserAttributes: [
      { Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }, { Name: 'name', Value: name },
    ],
  });
  await cognito('AdminSetUserPassword', { UserPoolId: POOL, Username: email, Password: password, Permanent: true });
  // The org comes from the account's claims, never from the request: this is THE separation point.
  await cognito('AdminUpdateUserAttributes', {
    UserPoolId: POOL, Username: email,
    UserAttributes: [
      { Name: 'custom:role', Value: 'org_admin' },
      { Name: 'custom:org_id', Value: orgId },
    ],
  });
}

/** Verifies the login end to end and returns the ID-token claims the ERP will act on. */
async function verifyLogin(email, password) {
  const r = await cognito('InitiateAuth', {
    ClientId: CLIENT_ID, AuthFlow: 'USER_PASSWORD_AUTH', AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  const token = r.AuthenticationResult?.IdToken;
  if (!token) throw new Error(`login failed for ${email}`);
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

/** One agency's seed: enough data to see isolation in the UI (dashboard, units, contacts, leases). */
async function seedAgency(tag, orgId, leaseNumber) {
  const [branch, property, contact] = [randomUUID(), randomUUID(), randomUUID()];
  const units = [randomUUID(), randomUUID()];
  await put('Organization', { id: orgId, name: `Agence ${tag}` });
  await put('Branch', { id: branch, organization_id: orgId, name: `Siège ${tag}`, city: 'Tunis' });
  await put('Property', { id: property, organization_id: orgId, branch_id: branch, name: `Résidence ${tag}`, type: 'building', city: 'Aouina' });
  await put('Unit', { id: units[0], organization_id: orgId, property_id: property, code: `${tag}-A1`, type: 'apartment', status: 'vacant', rent_amount: 1850, show_on_website: true, title: `S+2 ${tag} A1` });
  await put('Unit', { id: units[1], organization_id: orgId, property_id: property, code: `${tag}-A2`, type: 'apartment', status: 'occupied', rent_amount: 2100, show_on_website: false, title: `S+3 ${tag} A2` });
  await put('Contact', { id: contact, organization_id: orgId, full_name: `Locataire ${tag}`, kind: 'individual' });
  await put('Lease', { id: randomUUID(), organization_id: orgId, number: leaseNumber, status: 'active', start_date: '2026-06-01', end_date: '2027-05-31', unit_ids: [units[1]], signed_at: '2026-05-20', rents: [], terms: [] });
  return { orgId, property, units, contact };
}

const PASSWORD = 'Demo!Agence2026';
const A = { tag: 'A', orgId: randomUUID(), email: 'admin-a@agence-a.test', name: 'Admin Agence A' };
const B = { tag: 'B', orgId: randomUUID(), email: 'admin-b@agence-b.test', name: 'Admin Agence B' };

for (const [o, n] of [[A, 8001], [B, 8002]]) {
  await seedAgency(o.tag, o.orgId, n);
  await createAdminAccount(o.email, PASSWORD, o.name, o.orgId);
  const claims = await verifyLogin(o.email, PASSWORD);
  console.log(`Agence ${o.tag}`);
  console.log(`  email       : ${o.email}`);
  console.log(`  mot de passe: ${PASSWORD}`);
  console.log(`  org_id      : ${o.orgId}`);
  console.log(`  JWT claims  : custom:role=${claims['custom:role']} custom:org_id=${claims['custom:org_id']} sub=${claims.sub}`);
}
console.log('\nLog in at the ERP (npm run dev in web/, http://localhost:3000) with each account in turn:');
console.log('each one must see only its own agency data, and a foreign id must answer not found.');
