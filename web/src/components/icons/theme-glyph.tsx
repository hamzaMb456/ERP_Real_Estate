'use client';

import { useRef } from 'react';
import { canMatchMedia, ERP_EASE, gsap, gsapTokens, MOTION_QUERIES, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils';
import { ICON_DATA } from './icon-data';

// Sun disc and moon crescent share one body path so MorphSVG can tween between them.
const SUN_BODY = 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8z';
const MOON_BODY = ICON_DATA.Moon[0][1].d;
const RAYS = ICON_DATA.Sun.flatMap(([tag, attrs]) => (tag === 'path' && 'd' in attrs ? [attrs.d] : []));

/** Header theme icon: the sun disc morphs into a moon and the rays fold away. */
export function ThemeGlyph({ dark, className }: { dark: boolean; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGPathElement>(null);
  const raysRef = useRef<SVGGElement>(null);
  const settled = useRef(false);

  useGSAP(
    () => {
      const body = bodyRef.current;
      const rays = raysRef.current;
      if (!body || !rays || !canMatchMedia()) return;
      const target = dark ? MOON_BODY : SUN_BODY;
      const mm = gsap.matchMedia();
      mm.add({ full: MOTION_QUERIES.full, reduced: MOTION_QUERIES.reduced }, (context) => {
        // The first run only syncs the glyph to the stored theme; later runs animate.
        const duration = settled.current && !context.conditions?.reduced ? gsapTokens.morph.duration : 0;
        settled.current = true;
        gsap.to(body, { morphSVG: target, duration, ease: ERP_EASE, overwrite: 'auto' });
        gsap.to(rays, {
          autoAlpha: dark ? 0 : 1,
          scale: dark ? 0.4 : 1,
          rotation: dark ? -45 : 0,
          svgOrigin: '12 12',
          duration: duration * 0.7,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      });
      return () => mm.revert();
    },
    { scope: svgRef, dependencies: [dark], revertOnUpdate: false },
  );

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0', className)}
    >
      <path ref={bodyRef} d={SUN_BODY} />
      <g ref={raysRef}>
        {RAYS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}
