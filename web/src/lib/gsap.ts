import gsap from 'gsap';
import { CustomEase } from 'gsap/CustomEase';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

// Register once at module scope; useGSAP is itself a GSAP plugin.
gsap.registerPlugin(useGSAP, DrawSVGPlugin, MorphSVGPlugin, ScrollTrigger, ScrollToPlugin, SplitText, CustomEase);

// Shared ease, same curve as motionTokens.easing.smooth.
export const ERP_EASE = 'erp';
CustomEase.create(ERP_EASE, '0.22,1,0.36,1');

// Every GSAP duration in the app, in seconds. Kept short on purpose: UI motion should read as instant
// feedback, not as a wait. Kept in step with the scale in motion-tokens.ts.
export const gsapTokens = {
  press: { scale: 0.88, duration: 0.08, ease: 'power2.out' },
  release: { duration: 0.18, ease: 'back.out(2.2)' },
  draw: { duration: 0.25, ease: 'power2.out', stagger: 0.03 },
  spin: { duration: 0.9, ease: 'none' },
  reveal: { duration: 0.3, ease: ERP_EASE, distance: 12, stagger: 0.04 },
  hover: { duration: 0.12 },
  magnet: { duration: 0.15 },
  shine: { duration: 0.4 },
  overlay: { duration: 0.22 },
  title: { duration: 0.3, stagger: 0.03 },
  morph: { duration: 0.25 },
  pop: { duration: 0.15 },
  scroll: { duration: 0.3, scrub: 0.1 },
} as const;

export const MOTION_QUERIES = {
  full: '(prefers-reduced-motion: no-preference)',
  reduced: '(prefers-reduced-motion: reduce)',
} as const;

/** True when the browser can evaluate media queries (false under bare jsdom). */
export const canMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function';

const watchedScrollers = new WeakSet<HTMLElement>();
const REFRESH_DEBOUNCE_MS = 120;

// Content that loads after a trigger was created moves the trigger's measured position;
// re-measure when the scroller's content changes size so reveals never wait on stale numbers.
function refreshOnContentResize(scroller: HTMLElement) {
  if (watchedScrollers.has(scroller) || typeof ResizeObserver === 'undefined') return;
  watchedScrollers.add(scroller);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observer = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => ScrollTrigger.refresh(), REFRESH_DEBOUNCE_MS);
  });
  for (const child of Array.from(scroller.children)) observer.observe(child);
}

/** Nearest ancestor that scrolls vertically, or undefined to fall back to the window. */
export function getScrollParent(el: HTMLElement): HTMLElement | undefined {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      refreshOnContentResize(node);
      return node;
    }
  }
  return undefined;
}

export { gsap, useGSAP, DrawSVGPlugin, MorphSVGPlugin, ScrollTrigger, ScrollToPlugin, SplitText, CustomEase };
