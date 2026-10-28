#!/usr/bin/env node
// Dry health checks. Invoke mailer with an empty batch (exercises resolveSecretEnv
// = secret readability, throws nothing if fine). Authorizer token sanity via JWKS fetch.
import { InvokeCommand, LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda';

const L = new LambdaClient({ region: 'us-east-1', endpoint: 'http://localhost:4566', credentials: { accessKeyId: 'test', secretAccessKey: 'test' } });

const all = await L.send(new ListFunctionsCommand({}));
const fns = all.Functions ?? [];
const mailer = fns.find((f) => /-Mailer/.test(f.FunctionName));
const artifactizer = fns.find((f) => /-Authorizer/.test(f.FunctionName));

// 1. mailer with empty batch
const r = await L.send(new InvokeCommand({ FunctionName: mailer.FunctionName, Payload: Buffer.from('{}') }));
console.log('mailer (empty batch):', r.FunctionError ? ' FunctionError ' + Buffer.from(r.Payload).toString().slice(0, 200) : Buffer.from(r.Payload).toString());

// 2. authorizer with garbage token → must reject cleanly
if (artifactizer) {
  const a = await L.send(new InvokeCommand({ FunctionName: artifactizer.FunctionName, Payload: Buffer.from(JSON.stringify({ authorizationToken: 'garbage' })) }));
  console.log('authorizer (garbage):', r.FunctionError ? 'FunctionError' : Buffer.from(a.Payload).toString().slice(0, 200));
}
