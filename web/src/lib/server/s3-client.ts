import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';

/**
 * S3-compatible client for property/lease file storage.
 * Points at Floci locally (`S3_ENDPOINT=http://localhost:4566`) or a real S3-compatible
 * endpoint in other environments; `forcePathStyle` is required for Floci/MinIO-style hosts.
 */
function client(endpoint: string | undefined): S3Client {
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'test',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'test',
    },
  });
}

/** Used by the server itself (put, delete). In Docker this is the storage service name, e.g. http://floci:4566. */
export const s3 = client(process.env.S3_ENDPOINT);

/**
 * Only signs download links that the BROWSER opens, so it must use an address the browser can reach
 * (S3_PUBLIC_ENDPOINT, e.g. http://localhost:4566 when the server runs in Docker). Signing makes no network call.
 * Falls back to S3_ENDPOINT when the server and the browser see the storage at the same address.
 */
export const s3Public = client(process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT);
