// Deploys the 3 Hasura-facing Lambdas (lease-daily, send-notification-email, send-appointment-email) and the
// REST API in front of them to Floci. Idempotent: existing functions get new code, an existing API is reused.
//   node scripts/build-lambda.mjs                     (builds dist/<name>.zip, run from functions/)
//   NHOST_WEBHOOK_SECRET=... node scripts/deploy-floci.mjs [--endpoint http://localhost:4566]
// Prints the functions base URL: the public (tunnel) host + /restapis/<id>/prod/_user_request_ is what Nhost's
// NHOST_FUNCTIONS_URL must be set to. Plain fetch, no dependencies: Floci accepts unsigned requests.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const endpointArg = process.argv.indexOf('--endpoint');
const ENDPOINT = (endpointArg > -1 ? process.argv[endpointArg + 1] : process.env.FLOCI_ENDPOINT ?? 'http://localhost:4566').replace(/\/$/, '');
// What the functions themselves use to reach Floci (the container network name, not localhost).
const INNER_ENDPOINT = process.env.FUNCTIONS_AWS_ENDPOINT_URL ?? 'http://floci:4566';
const REGION = process.env.AWS_REGION ?? 'us-east-1';
const ACCOUNT = '000000000000';
const SECRET_NAME = process.env.SECRET_NAME ?? 'erp-functions-config';
const WEBHOOK_SECRET = process.env.NHOST_WEBHOOK_SECRET;
const NAMES = ['lease-daily', 'send-notification-email', 'send-appointment-email'];
const API_NAME = 'floci-functions';
const STAGE = 'prod';
const dist = path.resolve(import.meta.dirname, '..', 'dist');

if (!WEBHOOK_SECRET) {
  console.error('NHOST_WEBHOOK_SECRET is required (the same value as in Nhost\'s environment); it is never printed.');
  process.exit(1);
}

const auth = (service) => `AWS4-HMAC-SHA256 Credential=test/20260101/${REGION}/${service}/aws4_request, SignedHeaders=host, Signature=unsigned`;

async function call(service, method, route, body) {
  const res = await fetch(`${ENDPOINT}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: auth(service) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: res.status, json, text };
}

function must(res, what) {
  if (res.status >= 300) throw new Error(`${what} failed: HTTP ${res.status} ${res.text.slice(0, 200)}`);
  return res.json;
}

async function deployFunction(name) {
  const zip = (await readFile(path.join(dist, `${name}.zip`))).toString('base64');
  const environment = { Variables: { NHOST_WEBHOOK_SECRET: WEBHOOK_SECRET, SECRET_NAME, AWS_ENDPOINT_URL: INNER_ENDPOINT, AWS_REGION: REGION } };
  const existing = await call('lambda', 'GET', `/2015-03-31/functions/${name}`);
  if (existing.status === 200) {
    must(await call('lambda', 'PUT', `/2015-03-31/functions/${name}/code`, { ZipFile: zip }), `update code ${name}`);
    must(await call('lambda', 'PUT', `/2015-03-31/functions/${name}/configuration`, { Environment: environment }), `update config ${name}`);
    console.log(`updated function ${name}`);
    return;
  }
  must(await call('lambda', 'POST', '/2015-03-31/functions', {
    FunctionName: name, Runtime: 'nodejs20.x', Handler: 'index.handler', Role: `arn:aws:iam::${ACCOUNT}:role/lambda-role`,
    Code: { ZipFile: zip }, Environment: environment,
  }), `create ${name}`);
  console.log(`created function ${name}`);
}

async function deployApi() {
  const list = must(await call('apigateway', 'GET', '/restapis'), 'list apis');
  let api = (list.item ?? []).find((a) => a.name === API_NAME);
  if (!api) {
    api = must(await call('apigateway', 'POST', '/restapis', { name: API_NAME }), 'create api');
    console.log(`created REST API ${api.id}`);
  }
  const resources = must(await call('apigateway', 'GET', `/restapis/${api.id}/resources`), 'list resources').item ?? [];
  const root = resources.find((r) => r.path === '/');
  for (const name of NAMES) {
    let resource = resources.find((r) => r.path === `/${name}`);
    if (!resource) resource = must(await call('apigateway', 'POST', `/restapis/${api.id}/resources/${root.id}`, { pathPart: name }), `resource ${name}`);
    const base = `/restapis/${api.id}/resources/${resource.id}/methods/POST`;
    if (!resource.resourceMethods?.POST) must(await call('apigateway', 'PUT', base, { authorizationType: 'NONE' }), `method ${name}`);
    must(await call('apigateway', 'PUT', `${base}/integration`, {
      type: 'AWS_PROXY', httpMethod: 'POST',
      uri: `arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/arn:aws:lambda:${REGION}:${ACCOUNT}:function:${name}/invocations`,
    }), `integration ${name}`);
  }
  must(await call('apigateway', 'POST', `/restapis/${api.id}/deployments`, { stageName: STAGE }), 'deployment');
  return api.id;
}

for (const name of NAMES) await deployFunction(name);
const apiId = await deployApi();
console.log(`\nfunctions base URL (local): ${ENDPOINT}/restapis/${apiId}/${STAGE}/_user_request_`);
console.log('Set Nhost NHOST_FUNCTIONS_URL to <public tunnel host>/restapis/' + `${apiId}/${STAGE}/_user_request_ (no trailing slash).`);
