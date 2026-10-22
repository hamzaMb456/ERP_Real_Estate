// Public photo urls. Kept apart from public-api.ts (server only) so client components can build image urls too;
// public-api.ts re-exports it.

/** A stored photo served by Nhost storage, resized to `width` pixels. The file is readable without a session. */
export function publicImageUrl(fileId: string, width: number): string {
  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  return `https://${subdomain}.storage.${region}.nhost.run/v1/files/${encodeURIComponent(fileId)}?w=${width}&q=80`;
}
