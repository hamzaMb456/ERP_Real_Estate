'use client';

import { createElement, useRef, type ComponentType, type Ref, type SVGAttributes } from 'react';
import { canMatchMedia, gsap, gsapTokens, MOTION_QUERIES, useGSAP } from '@/lib/gsap';
import { cn } from '@/lib/utils';
import { ICON_DATA, type IconName, type IconNode } from './icon-data';

export type IconAnimation = 'hover' | 'draw' | 'spin' | 'none';

export type IconProps = Omit<SVGAttributes<SVGSVGElement>, 'children'> & {
  size?: number | string;
  strokeWidth?: number | string;
  /** hover: redraw on parent control hover/focus + press feedback. draw: once on mount. spin: loader. none: static. */
  animation?: IconAnimation;
  ref?: Ref<SVGSVGElement>;
};

export type LucideIcon = ComponentType<IconProps>;

// Controls whose hover/focus/press drives the icon inside them.
const HOST_SELECTOR =
  'button,a,label,summary,[role="button"],[role="menuitem"],[role="menuitemradio"],[role="menuitemcheckbox"],[role="tab"],[role="option"]';
const DISABLED_SELECTOR = ':disabled,[aria-disabled="true"],[data-disabled]';
const GLYPH_ORIGIN = '12 12';

export function AnimatedIcon({
  node,
  size = 24,
  strokeWidth = 2,
  animation = 'hover',
  className,
  ref,
  ...rest
}: IconProps & { node: IconNode }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const glyphRef = useRef<SVGGElement>(null);
  // A CSS spin on the root would fight the GSAP spin on the glyph.
  const mode: IconAnimation = className?.includes('animate-spin') ? 'none' : animation;

  useGSAP(
    (_, contextSafe) => {
      const svg = svgRef.current;
      const glyph = glyphRef.current;
      if (!svg || !glyph || !contextSafe || mode === 'none' || !canMatchMedia()) return;

      const strokes = Array.from(glyph.children);
      const mm = gsap.matchMedia();
      const draw = () =>
        gsap.fromTo(
          strokes,
          { drawSVG: '0% 0%' },
          {
            drawSVG: '0% 100%',
            ...gsapTokens.draw,
            // clearProps on the tween itself is ignored by DrawSVG, so reset the inline dash styles explicitly.
            onComplete: () => {
              gsap.set(strokes, { clearProps: 'strokeDasharray,strokeDashoffset' });
            },
          },
        );

      mm.add(MOTION_QUERIES.full, () => {
        if (mode === 'draw') {
          draw();
          return;
        }
        if (mode === 'spin') {
          gsap.to(glyph, { rotation: 360, svgOrigin: GLYPH_ORIGIN, repeat: -1, ...gsapTokens.spin });
          return;
        }

        const host = svg.closest(HOST_SELECTOR);
        if (!host) return;
        let drawing: gsap.core.Tween | undefined;
        const disabled = () => host.matches(DISABLED_SELECTOR);

        const redraw = contextSafe(() => {
          if (disabled() || drawing?.isActive()) return;
          drawing = draw();
        });
        const onFocusIn = () => {
          if (host.matches(':focus-visible')) redraw();
        };
        const press = contextSafe(() => {
          if (disabled()) return;
          gsap.to(glyph, { svgOrigin: GLYPH_ORIGIN, overwrite: 'auto', ...gsapTokens.press });
        });
        const release = contextSafe(() => {
          gsap.to(glyph, {
            scale: 1,
            svgOrigin: GLYPH_ORIGIN,
            overwrite: 'auto',
            ...gsapTokens.release,
            onComplete: () => {
              gsap.set(glyph, { clearProps: 'transform' });
            },
          });
        });

        host.addEventListener('pointerenter', redraw);
        host.addEventListener('focusin', onFocusIn);
        host.addEventListener('pointerdown', press);
        host.addEventListener('pointerup', release);
        host.addEventListener('pointerleave', release);
        host.addEventListener('pointercancel', release);
        return () => {
          host.removeEventListener('pointerenter', redraw);
          host.removeEventListener('focusin', onFocusIn);
          host.removeEventListener('pointerdown', press);
          host.removeEventListener('pointerup', release);
          host.removeEventListener('pointerleave', release);
          host.removeEventListener('pointercancel', release);
        };
      });

      // Reduced motion: no drawing or rotation; a loader still needs to read as busy.
      mm.add(MOTION_QUERIES.reduced, () => {
        if (mode === 'spin') {
          gsap.fromTo(svg, { opacity: 1 }, { opacity: 0.4, duration: 0.8, ease: 'sine.inOut', repeat: -1, yoyo: true });
        }
      });

      return () => mm.revert();
    },
    { scope: svgRef, dependencies: [mode], revertOnUpdate: true },
  );

  const labelled = rest['aria-label'] != null || rest['aria-labelledby'] != null;

  return (
    <svg
      ref={(el) => {
        svgRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={labelled ? 'img' : undefined}
      aria-hidden={labelled ? undefined : true}
      className={cn('shrink-0', className)}
      {...rest}
    >
      <g data-glyph="" ref={glyphRef}>
        {node.map(([tag, attrs], index) => createElement(tag, { key: index, ...attrs }))}
      </g>
    </svg>
  );
}

export function makeIcon(
  name: IconName,
  defaults: Pick<IconProps, 'animation' | 'size' | 'strokeWidth'> = {},
): LucideIcon {
  const node = ICON_DATA[name];
  const Icon: LucideIcon = (props) => <AnimatedIcon node={node} {...defaults} {...props} />;
  Icon.displayName = name;
  return Icon;
}
