#!/usr/bin/env node
// Make Amplify Gen2 / CDK output deployable on Floci.
//
//   node patch.mjs <cdk.out dir>                       patch templates on disk
//   node patch.mjs <cdk.out dir> --upload              ...and re-upload them to the CDK asset bucket
//   node patch.mjs <cdk.out dir> --update <stackName>  ...and UpdateStack the live stack tree
//
// Floci quirks fixed (see memory: project_floci_migration):
//   1. AppSync CFN resources take `XxxS3Location` -> Floci wants inline `Xxx`.
//   2. Floci's VTL executor needs `"version"` on every request template.
//   3. Empty `IdentityValidationExpression` on a Lambda authorizer denies every token.
// Idempotent: a patched template is left unchanged on re-run.
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const ENDPOINT = process.env.AWS_ENDPOINT_URL ?? 'http://localhost:4566';
const REGION = process.env.AWS_REGION ?? 'us-east-1';
const ACCOUNT = '000000000000';
const BARE_PASSTHROUGH = '$util.toJson({})';
const VERSIONED_PASSTHROUGH = '$util.toJson({"version": "2018-05-29"})';

const S3_LOCATION = /^(.+)S3Location$/;
const ASSET_KEY = /\/([0-9a-f]{64}\.[A-Za-z0-9]+)$/;

/** Walk a value, inlining `XxxS3Location` props. Returns the number of edits. */
export function patchNode(node, readAsset) {
  if (Array.isArray(node)) return node.reduce((n, v) => n + patchNode(v, readAsset), 0);
  if (node === null || typeof node !== 'object') return 0;
  let edits = 0;
  for (const key of Object.keys(node)) {
    const match = S3_LOCATION.exec(key);
    const sub = match && node[key]?.['Fn::Sub'];
    const asset = typeof sub === 'string' && ASSET_KEY.exec(sub);
    if (asset) {
      node[match[1]] = readAsset(asset[1]);
      delete node[key];
      edits += 1;
    } else {
      edits += patchNode(node[key], readAsset);
    }
  }
  return edits;
}

/** Add the version field to bare NONE-datasource request templates. */
export function patchVersions(node) {
  if (Array.isArray(node)) return node.reduce((n, v) => n + patchVersions(v), 0);
  if (node === null || typeof node !== 'object') return 0;
  let edits = 0;
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (key === 'RequestMappingTemplate' && typeof value === 'string' && value.includes(BARE_PASSTHROUGH)) {
      node[key] = value.split(BARE_PASSTHROUGH).join(VERSIONED_PASSTHROUGH);
      edits += 1;
    } else {
      edits += patchVersions(value);
    }
  }
  return edits;
}

/** Floci compiles an empty Lambda-authorizer regex, which then rejects every token. */
export function dropEmptyIdentityRegex(node) {
  if (Array.isArray(node)) return node.reduce((n, v) => n + dropEmptyIdentityRegex(v), 0);
  if (node === null || typeof node !== 'object') return 0;
  let edits = 0;
  for (const key of Object.keys(node)) {
    if (key === 'IdentityValidationExpression' && node[key] === '') {
      delete node[key];
      edits += 1;
    } else {
      edits += dropEmptyIdentityRegex(node[key]);
    }
  }
  return edits;
}

export function patchDir(dir) {
  const readAsset = (file) => readFileSync(join(dir, `asset.${file}`), 'utf8');
  const patched = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.template.json'))) {
    const path = join(dir, name);
    const template = JSON.parse(readFileSync(path, 'utf8'));
    const edits = patchNode(template.Resources, readAsset)
      + patchVersions(template.Resources)
      + dropEmptyIdentityRegex(template.Resources);
    if (edits > 0) {
      writeFileSync(path, JSON.stringify(template, null, 2));
      patched.push({ name, edits });
    }
  }
  return patched;
}

const fillPlaceholders = (s) => s.replace('${AWS::AccountId}', ACCOUNT).replace('${AWS::Region}', REGION);

function clientConfig() {
  return {
    endpoint: ENDPOINT,
    region: REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  };
}

/** Nested stacks read their template from the CDK asset bucket, not from cdk.out. */
async function uploadTemplates(dir, S3, names) {
  const s3 = new S3.S3Client(clientConfig());
  for (const assetsFile of readdirSync(dir).filter((f) => f.endsWith('.assets.json'))) {
    const files = JSON.parse(readFileSync(join(dir, assetsFile), 'utf8')).files ?? {};
    for (const entry of Object.values(files)) {
      const file = basename(entry.source?.path ?? '');
      if (!names.includes(file)) continue;
      for (const dest of Object.values(entry.destinations)) {
        await s3.send(new S3.PutObjectCommand({
          Bucket: fillPlaceholders(dest.bucketName),
          Key: dest.objectKey,
          Body: readFileSync(join(dir, file)),
          ContentType: 'application/json',
        }));
        console.log(`uploaded ${file} -> ${dest.objectKey}`);
      }
    }
  }
}

/**
 * CDK compares local template hashes and skips CloudFormation when nothing it
 * knows about changed, so push patched nested templates with UpdateStack directly.
 */
async function updateTree(dir, CFN, stackName, templateFile) {
  const cfn = new CFN.CloudFormationClient(clientConfig());
  const template = JSON.parse(readFileSync(join(dir, templateFile), 'utf8'));
  for (const [logicalId, res] of Object.entries(template.Resources ?? {})) {
    const nestedFile = res.Metadata?.['aws:asset:path'];
    if (res.Type !== 'AWS::CloudFormation::Stack' || !nestedFile || !existsSync(join(dir, nestedFile))) continue;
    const { StackResourceDetail } = await cfn.send(new CFN.DescribeStackResourceCommand({ StackName: stackName, LogicalResourceId: logicalId }));
    const nestedArn = StackResourceDetail.PhysicalResourceId;
    await updateTree(dir, CFN, nestedArn, nestedFile);
    const { Stacks } = await cfn.send(new CFN.DescribeStacksCommand({ StackName: nestedArn }));
    try {
      await cfn.send(new CFN.UpdateStackCommand({
        StackName: nestedArn,
        TemplateBody: readFileSync(join(dir, nestedFile), 'utf8'),
        Parameters: (Stacks[0].Parameters ?? []).map((p) => ({ ParameterKey: p.ParameterKey, UsePreviousValue: true })),
        Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM', 'CAPABILITY_AUTO_EXPAND'],
      }));
      console.log(`updated ${logicalId}`);
    } catch (err) {
      if (!/No updates are to be performed/.test(String(err.message))) throw err;
      console.log(`unchanged ${logicalId}`);
    }
  }
}

async function main() {
  const [dir, ...flags] = process.argv.slice(2);
  if (!dir) {
    console.error('usage: node patch.mjs <cdk.out dir> [--upload] [--update <stackName>]');
    process.exit(1);
  }
  const patched = patchDir(dir);
  for (const { name, edits } of patched) console.log(`patched ${name} (${edits} edits)`);
  if (patched.length === 0) console.log('nothing to patch (already patched?)');

  if (flags.includes('--upload')) {
    await uploadTemplates(dir, await import('@aws-sdk/client-s3'), readdirSync(dir).filter((f) => f.endsWith('.template.json')));
  }
  const updateAt = flags.indexOf('--update');
  if (updateAt !== -1) {
    const stackName = flags[updateAt + 1];
    await updateTree(dir, await import('@aws-sdk/client-cloudformation'), stackName, `${stackName}.template.json`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
