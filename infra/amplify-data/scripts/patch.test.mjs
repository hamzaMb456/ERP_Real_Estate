import { test } from 'node:test';
import assert from 'node:assert/strict';
import { patchNode, patchVersions, dropEmptyIdentityRegex } from './patch.mjs';

const hash = 'a'.repeat(64);
const s3 = (ext) => ({ 'Fn::Sub': `s3://cdk-hnb659fds-assets-\${AWS::AccountId}-\${AWS::Region}/${hash}.${ext}` });

test('inlines S3Location props and drops the location key', () => {
  const resources = {
    Schema: { Properties: { DefinitionS3Location: s3('graphql'), ApiId: 'x' } },
    Fn: { Properties: { RequestMappingTemplateS3Location: s3('vtl') } },
  };
  const edits = patchNode(resources, (file) => `content of ${file}`);
  assert.equal(edits, 2);
  assert.equal(resources.Schema.Properties.Definition, `content of ${hash}.graphql`);
  assert.equal(resources.Fn.Properties.RequestMappingTemplate, `content of ${hash}.vtl`);
  assert.equal('DefinitionS3Location' in resources.Schema.Properties, false);
  assert.equal(resources.Schema.Properties.ApiId, 'x');
});

test('leaves S3Location props without a CDK asset key alone', () => {
  const resources = { R: { Properties: { CodeS3Location: { Ref: 'Param' } } } };
  assert.equal(patchNode(resources, () => ''), 0);
  assert.deepEqual(resources.R.Properties.CodeS3Location, { Ref: 'Param' });
});

test('drops only an empty Lambda-authorizer regex', () => {
  const resources = {
    Api: { Properties: { LambdaAuthorizerConfig: { AuthorizerUri: 'arn', IdentityValidationExpression: '' } } },
    Other: { Properties: { LambdaAuthorizerConfig: { IdentityValidationExpression: '^Bearer .+' } } },
  };
  assert.equal(dropEmptyIdentityRegex(resources), 1);
  assert.equal('IdentityValidationExpression' in resources.Api.Properties.LambdaAuthorizerConfig, false);
  assert.equal(resources.Other.Properties.LambdaAuthorizerConfig.IdentityValidationExpression, '^Bearer .+');
});

test('versions bare request passthroughs only', () => {
  const resources = {
    A: { Properties: { RequestMappingTemplate: '#if(1)\n#end\n$util.toJson({})', ResponseMappingTemplate: '$util.toJson({})' } },
    B: { Properties: { RequestMappingTemplate: '$util.toJson({"version":"2018-05-29"})' } },
  };
  assert.equal(patchVersions(resources), 1);
  assert.match(resources.A.Properties.RequestMappingTemplate, /"version": "2018-05-29"/);
  assert.equal(resources.A.Properties.ResponseMappingTemplate, '$util.toJson({})');
  assert.equal(patchVersions(resources), 0);
});
