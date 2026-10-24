#!/usr/bin/env node
// Deploy the data layer to Floci: synth -> refuse if the stack is stuck -> patch + upload
// the nested templates (see patch.mjs) -> cdk deploy.
//
//   node scripts/deploy.mjs [dev|main] [--yes]     (default dev; main needs --yes)
//
// Floci cannot roll back a failed update, so a failed deploy leaves the stack in
// *_FAILED. Tables are RETAIN, but the stack must be repaired by hand: this script never
// deletes a stack.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CloudFormationClient, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';

const ENVS = new Set(['dev', 'main']);
const OUT = join('.amplify', 'artifacts', 'cdk.out');
const STUCK = /(_FAILED|ROLLBACK_IN_PROGRESS|_IN_PROGRESS)$/;

const env = process.argv[2] ?? 'dev';
if (!ENVS.has(env)) {
  console.error(`usage: node scripts/deploy.mjs [${[...ENVS].join('|')}]`);
  process.exit(1);
}

process.env.AWS_ENDPOINT_URL ??= 'http://localhost:4566';
process.env.AWS_REGION ??= 'us-east-1';
process.env.AWS_DEFAULT_REGION ??= process.env.AWS_REGION;
process.env.AWS_ACCESS_KEY_ID ??= 'test';
process.env.AWS_SECRET_ACCESS_KEY ??= 'test';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

function stackName() {
  const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
  const stack = Object.values(manifest.artifacts).find((a) => a.type === 'aws:cloudformation:stack');
  return stack.properties?.stackName ?? stack.displayName;
}

async function assertNotStuck(name) {
  const cfn = new CloudFormationClient({});
  try {
    const { Stacks } = await cfn.send(new DescribeStacksCommand({ StackName: name }));
    const status = Stacks[0].StackStatus;
    if (STUCK.test(status)) {
      throw new Error(`stack ${name} is ${status}; repair it before deploying (Floci has no rollback)`);
    }
    console.log(`stack ${name}: ${status}`);
    return true;
  } catch (err) {
    if (!/does not exist/.test(String(err.message))) throw err;
    console.log(`stack ${name}: new`);
    return false;
  }
}

// Backend type "sandbox": "branch" adds a custom resource that calls Amplify Hosting,
// which Floci does not emulate.
if (env === 'main' && !process.argv.includes('--yes')) {
  console.error('deploying main (production data): re-run with --yes to confirm');
  process.exit(1);
}

run(`npx cdk synth --quiet -o ${OUT} --app "npx tsx amplify/backend.ts"`
  + ` -c amplify-backend-namespace=erp -c amplify-backend-name=${env} -c amplify-backend-type=sandbox`);
const name = stackName();
const existed = await assertNotStuck(name);
run(`node scripts/patch.mjs ${OUT} --upload`);
run(`npx cdk deploy --app ${OUT} --all --require-approval never`);
// Nested template keys hash the *unpatched* content, so a patcher-only change leaves
// CDK seeing "no changes": push the patched nested templates directly.
if (existed) run(`node scripts/patch.mjs ${OUT} --update ${name}`);
// Floci only builds GSIs when it creates a table: add any index introduced since.
run(`node scripts/reconcile-indexes.mjs ${OUT} ${name}`);
