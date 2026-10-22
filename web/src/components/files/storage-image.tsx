'use client';

import { useEffect, useState } from 'react';
import { ImageOff } from '@/components/icons';
import { imageObjectUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';

type Loaded = { fileId: string; width: number; url: string | null };

export function StorageImage({ fileId, width, alt, className }: { fileId: string; width: number; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    imageObjectUrl(fileId, width)
      .then((url) => {
        objectUrl = url;
        if (active) setLoaded({ fileId, width, url });
        else URL.revokeObjectURL(url);
      })
      .catch(() => active && setLoaded({ fileId, width, url: null }));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId, width]);

  const current = loaded && loaded.fileId === fileId && loaded.width === width ? loaded : null;
  if (!current) return <div role="img" aria-label={alt} className={cn('animate-pulse bg-muted', className)} />;
  if (!current.url) {
    return (
      <div role="img" aria-label={alt} className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}>
        <ImageOff className="size-5" animation="draw" aria-hidden />
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- local blob URL of a private file; next/image cannot optimise it
  return <img src={current.url} alt={alt} className={className} />;
}
