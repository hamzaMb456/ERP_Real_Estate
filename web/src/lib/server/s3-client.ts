import 'server-only';
import { S3Client } from '@aws-sdk/client-s3';

/**
 * S3-compatible client for property/lease file storage.
 * Points at Floci locally (`S3_ENDPOINT=http://localhost:4566`) or a real S3-compatible
 * endpoint in other environments; `forcePathStyle` is required for Floci/MinIO-style hosts.
 */
export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? 'test',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? 'test',
  },
});
