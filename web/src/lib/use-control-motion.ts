import { useGSAP, gsap, gsapTokens, ERP_EASE, MOTION_QUERIES, canMatchMedia } from '@/lib/gsap';
import { useCallback, useRef, type Ref, type RefObject } from 'react';

export type ControlMotion = {
  /** Rise 1px on hover. */
  lift?: boolean;
  /** Sweep the gloss streak across (drives the --shine custom property read by the ::after rule). */
  shine?: boolean;
  /** Pull a few px toward the pointer. */
  magnet?: boolean;
  /** Only lift and sweep when the control actually carries a gloss ::after streak (plain ghost buttons stay flat). */
  glossOnly?: boolean;
};

const DISABLED_SELECTOR = ':disabled,[aria-disabled="true"],[data-disabled]';
const PRESS_SCALE = 0.96;
const LIFT_Y = -1;
const MAGNET_PULL = 0.12;
const MAGNET_MAX = 3;

const clamp = (value: number, max: number) => Math.max(-max, Math.min(max, value));

/**
 * GSAP motion for a pressable control: press squash with a spring release, optional hover lift,
 * gloss sweep and magnetic pull. Only transform and a CSS variable are animated, and nothing runs
 * under prefers-reduced-motion. Colours, gloss and shadows stay in CSS.
 */
export function useControlMotion(ref: RefObject<HTMLElement | null>, motion: ControlMotion | false) {
  const lift = motion ? !!motion.lift : false;
  const shine = motion ? !!motion.shine : false;
  const magnet = motion ? !!motion.magnet : false;
  const glossOnly = motion ? !!motion.glossOnly : false;
  const enabled = motion !== false;

  useGSAP(
    (_, contextSafe) => {
      const el = ref.current;
      if (!el || !enabled || !contextSafe || !canMatchMedia()) return;

      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES.full, () => {
        const off = () => el.matches(DISABLED_SELECTOR);
        const flat = () => glossOnly && getComputedStyle(el, '::after').content === 'none';
        const xTo = magnet ? gsap.quickTo(el, 'x', { duration: gsapTokens.magnet.duration, ease: 'power3' }) : undefined;
        const yTo = magnet ? gsap.quickTo(el, 'y', { duration: gsapTokens.magnet.duration, ease: 'power3' }) : undefined;
        const restY = lift ? LIFT_Y : 0;

        const enter = contextSafe((event: PointerEvent) => {
          if (event.pointerType === 'touch' || off() || flat()) return;
          if (lift) {
            if (yTo) yTo(restY);
            else gsap.to(el, { y: restY, duration: gsapTokens.hover.duration, ease: ERP_EASE, overwrite: 'auto' });
          }
          if (shine) {
            gsap.fromTo(el, { '--shine': 0 }, { '--shine': 1, duration: gsapTokens.shine.duration, ease: ERP_EASE, overwrite: 'auto' });
          }
        });

        const move = contextSafe((event: PointerEvent) => {
          if (!xTo || !yTo || event.pointerType === 'touch' || off()) return;
          const box = el.getBoundingClientRect();
          xTo(clamp((event.clientX - (box.left + box.width / 2)) * MAGNET_PULL, MAGNET_MAX));
          yTo(restY + clamp((event.clientY - (box.top + box.height / 2)) * MAGNET_PULL, MAGNET_MAX));
        });

        const press = contextSafe(() => {
          if (off()) return;
          gsap.to(el, { scale: PRESS_SCALE, duration: gsapTokens.press.duration, ease: gsapTokens.press.ease, overwrite: 'auto' });
        });

        const release = contextSafe(() => {
          gsap.to(el, { scale: 1, duration: gsapTokens.release.duration, ease: gsapTokens.release.ease, overwrite: 'auto' });
        });

        const leave = contextSafe(() => {
          gsap.set(el, { '--shine': 0 });
          gsap.to(el, {
            x: 0,
            y: 0,
            scale: 1,
            duration: gsapTokens.release.duration,
            ease: ERP_EASE,
            overwrite: 'auto',
            // Hand the transform back to CSS once the control is at rest.
            onComplete: () => {
              gsap.set(el, { clearProps: 'transform' });
            },
          });
        });

        el.addEventListener('pointerenter', enter);
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerdown', press);
        el.addEventListener('pointerup', release);
        el.addEventListener('pointercancel', leave);
        el.addEventListener('pointerleave', leave);
        return () => {
          el.removeEventListener('pointerenter', enter);
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerdown', press);
          el.removeEventListener('pointerup', release);
          el.removeEventListener('pointercancel', leave);
          el.removeEventListener('pointerleave', leave);
        };
      });

      return () => mm.revert();
    },
    { scope: ref, dependencies: [enabled, lift, shine, magnet, glossOnly], revertOnUpdate: true },
  );
}

export function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === 'function') ref(node);
  else if (ref) (ref as { current: T | null }).current = node;
}

/** Convenience wrapper: attaches the motion to the element and merges the caller's own ref. */
export function useControlRef<T extends HTMLElement>(forwardedRef: Ref<T> | undefined, motion: ControlMotion | false) {
  const localRef = useRef<HTMLElement | null>(null);
  useControlMotion(localRef, motion);
  return useCallback(
    (node: T | null) => {
      localRef.current = node;
      assignRef(forwardedRef, node);
    },
    [forwardedRef],
  );
}
