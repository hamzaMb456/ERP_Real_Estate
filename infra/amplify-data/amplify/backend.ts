import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { EventSourceMapping, Runtime, StartingPosition } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { CfnSchedule } from 'aws-cdk-lib/aws-scheduler';
import { defineBackend } from '@aws-amplify/backend';
import { AmplifyGraphqlApi, AmplifyGraphqlDefinition } from '@aws-amplify/graphql-api-construct';

const ROOT = process.cwd();
// Cognito user pool on Floci. Floci issues tokens with the internal host in `iss`, and the authorizer
// runs inside Floci, so both the JWKS URL and the issuer use the floci hostname.
const COGNITO_POOL_ID = process.env.ERP_COGNITO_POOL_ID ?? 'us-east-1_dadf1b949';
const JWT_ISSUER = `https://floci:4566/${COGNITO_POOL_ID}`;
const JWKS_URL = `http://floci:4566/${COGNITO_POOL_ID}/.well-known/jwks.json`;
// SMTP + APP_URL, shared with the functions/ Lambdas (Floci Secrets Manager).
const SECRET_NAME = process.env.ERP_SECRET_NAME ?? 'erp-functions-config';
// 05:00 UTC = 06:00 Tunis (Tunisia has no daylight saving time).
const DAILY_SCHEDULE = 'cron(0 5 * * ? *)';
const MAILED_MODELS = ['Notification', 'AppointmentParticipant', 'Appointment'];

// Tables only: no generated CRUD, custom (Lambda) auth. All access goes through Lambda resolvers.
const TABLE_DIRECTIVE = '@model(queries: null, mutations: null, subscriptions: null, '
  + 'timestamps: { createdAt: "created_at", updatedAt: "updated_at" }) @auth(rules: [{ allow: custom }])';

const schema = readFileSync(path.join(ROOT, 'amplify', 'data', 'schema.graphql'), 'utf8')
  .replaceAll('@table', TABLE_DIRECTIVE);

const backend = defineBackend({});
const stack = backend.stack;

const lambdaFn = (id: string, dir: string, environment: Record<string, string> = {}, timeout = Duration.seconds(15)) =>
  new NodejsFunction(stack, id, {
    entry: path.join(ROOT, 'lambda', dir, 'index.ts'),
    runtime: Runtime.NODEJS_20_X,
    timeout,
    environment,
    projectRoot: ROOT,
    depsLockFilePath: path.join(ROOT, 'package-lock.json'),
  });

const authorizer = lambdaFn('Authorizer', 'authorizer', { JWKS_URL, JWT_ISSUER });
const apiFn = lambdaFn('Api', 'api');

const api = new AmplifyGraphqlApi(stack, 'ErpApi', {
  definition: AmplifyGraphqlDefinition.fromString(schema, { dbType: 'DYNAMODB', provisionStrategy: 'DEFAULT' }),
  authorizationModes: {
    defaultAuthorizationMode: 'AWS_LAMBDA',
    lambdaConfig: { function: authorizer, ttl: Duration.minutes(5) },
  },
  functionNameMap: { api: apiFn },
});

const dailyFn = lambdaFn('Daily', 'daily', {}, Duration.minutes(5));
const mailerFn = lambdaFn('Mailer', 'mailer', { SECRET_NAME }, Duration.minutes(1));

for (const fn of [apiFn, dailyFn, mailerFn]) {
  for (const [model, table] of Object.entries(api.resources.tables)) {
    fn.addEnvironment(`TABLE_${model.toUpperCase()}`, table.tableName);
    table.grantReadWriteData(fn);
  }
}

// E-mails follow table changes (Amplify already enables NEW_AND_OLD_IMAGES streams on every table).
mailerFn.addToRolePolicy(new iam.PolicyStatement({ actions: ['secretsmanager:GetSecretValue'], resources: ['*'] }));
for (const model of MAILED_MODELS) {
  const streamArn = api.resources.cfnResources.cfnTables[model].attrStreamArn;
  mailerFn.addToRolePolicy(new iam.PolicyStatement({
    actions: ['dynamodb:DescribeStream', 'dynamodb:GetRecords', 'dynamodb:GetShardIterator', 'dynamodb:ListStreams'],
    resources: [streamArn],
  }));
  new EventSourceMapping(stack, `Mail${model}`, {
    target: mailerFn,
    eventSourceArn: streamArn,
    startingPosition: StartingPosition.LATEST,
    batchSize: 10,
    retryAttempts: 2,
  });
}

const schedulerRole = new iam.Role(stack, 'DailySchedulerRole', { assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com') });
dailyFn.grantInvoke(schedulerRole);
new CfnSchedule(stack, 'DailySchedule', {
  scheduleExpression: DAILY_SCHEDULE,
  flexibleTimeWindow: { mode: 'OFF' },
  target: { arn: dailyFn.functionArn, roleArn: schedulerRole.roleArn },
});

// Production data lives in these tables: never let a stack change delete one.
for (const cfnTable of Object.values(api.resources.cfnResources.cfnTables)) {
  cfnTable.applyRemovalPolicy(RemovalPolicy.RETAIN);
}

api.resources.cfnResources.cfnTables['Notification'].timeToLiveSpecification = {
  attributeName: 'expires_at',
  enabled: true,
};
