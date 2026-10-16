import { describe, expect, it } from 'vitest';
import { isAuthorizedWebhook } from '../_lib/webhook';

describe('isAuthorizedWebhook', () => {
  it('accepts a matching secret', () => {
    expect(isAuthorizedWebhook({ 'x-nhost-webhook-secret': 'abc' }, 'abc')).toBe(true);
  });
  it('is case-insensitive on the header name', () => {
    expect(isAuthorizedWebhook({ 'X-Nhost-Webhook-Secret': 'abc' }, 'abc')).toBe(true);
  });
  it('rejects a wrong or missing secret', () => {
    expect(isAuthorizedWebhook({ 'x-nhost-webhook-secret': 'abd' }, 'abc')).toBe(false);
    expect(isAuthorizedWebhook({ 'x-nhost-webhook-secret': 'abcd' }, 'abc')).toBe(false);
    expect(isAuthorizedWebhook({}, 'abc')).toBe(false);
  });
  it('rejects everything when no secret is configured', () => {
    expect(isAuthorizedWebhook({ 'x-nhost-webhook-secret': '' }, '')).toBe(false);
    expect(isAuthorizedWebhook({ 'x-nhost-webhook-secret': 'x' }, undefined)).toBe(false);
  });
  it('rejects an array-valued header', () => {
    expect(isAuthorizedWebhook({ 'x-nhost-webhook-secret': ['abc', 'abc'] }, 'abc')).toBe(false);
  });
});
