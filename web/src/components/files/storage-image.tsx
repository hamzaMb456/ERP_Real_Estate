'use client';

import { useEffect, useState } from 'react';
import { ImageOff } from '@/components/icons';
import { presignedUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';

type Loaded = { fileId: string; url: string | null };

// `width` no longer resizes server-side (plain S3/Floci has no transform-on-fetch like
// Nhost's {w, q} did) — kept in the prop list so callers are unchanged; it only matters
// again if a per-size variant is added later.
export function StorageImage({ fileId, width: _width, alt, className }: { fileId: string; width: number; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    presignedUrl(fileId)
      .then((url) => active && setLoaded({ fileId, url }))
      .catch(() => active && setLoaded({ fileId, url: null }));
    return () => {
      active = false;
    };
  }, [fileId]);

  const current = loaded && loaded.fileId === fileId ? loaded : null;
  if (!current) return <div role="img" aria-label={alt} className={cn('animate-pulse bg-muted', className)} />;
  if (!current.url) {
    return (
      <div role="img" aria-label={alt} className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}>
        <ImageOff className="size-5" animation="draw" aria-hidden />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- presigned S3/Floci URL expires; next/image would cache it past that
  return <img src={current.url} alt={alt} className={className} />;
}
