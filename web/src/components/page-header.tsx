'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { canMatchMedia, ERP_EASE, gsap, gsapTokens, MOTION_QUERIES, SplitText, useGSAP } from '@/lib/gsap';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    document.title = title + ' · ERP Immobilier';
  }, [title]);

  // Words rise out of a mask; the split is reverted afterwards so the heading is plain text again.
  useGSAP(
    () => {
      const heading = titleRef.current;
      if (!heading || !canMatchMedia()) return;
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES.full, () => {
        const split = SplitText.create(heading, { type: 'words', mask: 'words' });
        gsap.from(split.words, {
          yPercent: 110,
          duration: gsapTokens.title.duration,
          stagger: gsapTokens.title.stagger,
          ease: ERP_EASE,
          onComplete: () => split.revert(),
        });
        return () => split.revert();
      });
      return () => mm.revert();
    },
    { scope: titleRef, dependencies: [title], revertOnUpdate: true },
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 ref={titleRef} className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
