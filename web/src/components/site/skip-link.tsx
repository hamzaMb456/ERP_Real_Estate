'use client';

import { useT } from '@/i18n/provider';

/** First focusable element of every public page: jumps over the header to `#contenu`. */
export function SkipLink() {
  const t = useT();
  return (
    <a
      href="#contenu"
      className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none focus:ring-3 focus:ring-ring/50"
    >
      {t.site.skipToContent}
    </a>
  );
}
