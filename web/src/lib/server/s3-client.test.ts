// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

vi.mock('server-only', () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('s3 clients', () => {
  it('uploads through the internal endpoint but signs download links for the browser endpoint', async () => {
    vi.stubEnv('S3_ENDPOINT', 'http://floci:4566');
    vi.stubEnv('S3_PUBLIC_ENDPOINT', 'http://localhost:4566');
    const { s3, s3Public } = await import('./s3-client');
    expect(String(await s3.config.endpoint?.().then((e) => `${e.protocol}//${e.hostname}:${e.port}`))).toBe('http://floci:4566');
    const url = await getSignedUrl(s3Public, new GetObjectCommand({ Bucket: 'property-files', Key: 'k' }), { expiresIn: 60 });
    expect(url.startsWith('http://localhost:4566/property-files/k?')).toBe(true);
  });

  it('uses the one endpoint for both when no public endpoint is set', async () => {
    vi.stubEnv('S3_ENDPOINT', 'http://localhost:4566');
    vi.stubEnv('S3_PUBLIC_ENDPOINT', '');
    const { s3Public } = await import('./s3-client');
    const url = await getSignedUrl(s3Public, new GetObjectCommand({ Bucket: 'property-files', Key: 'k' }), { expiresIn: 60 });
    expect(url.startsWith('http://localhost:4566/property-files/k?')).toBe(true);
  });
});
