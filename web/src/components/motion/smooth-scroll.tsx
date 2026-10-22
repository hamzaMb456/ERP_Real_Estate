'use client';

import { useEffect, type RefObject } from 'react';
import { canMatchMedia, gsap, gsapTokens, MOTION_QUERIES } from '@/lib/gsap';

const LINE_PX = 40;
const WHEEL_STEP_MIN = 50;

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

/** Notched mouse wheels report big whole-number steps (or lines); trackpads report small fractions and already coast. */
const isMouseWheel = (event: WheelEvent) =>
  event.deltaMode !== 0 || (Number.isInteger(event.deltaY) && Math.abs(event.deltaY) >= WHEEL_STEP_MIN);

/** True when something between the pointer and the page can still scroll that way (a table, a textarea, a list). */
function innerScrollerTakes(target: EventTarget | null, page: HTMLElement, deltaY: number) {
  for (let node = target instanceof Element ? target : null; node && node !== page; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY !== 'auto' && overflowY !== 'scroll') || node.scrollHeight <= node.clientHeight) continue;
    const atTop = node.scrollTop <= 0;
    const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
    if (deltaY < 0 ? !atTop : !atBottom) return true;
  }
  return false;
}

/**
 * Eases mouse-wheel scrolling of the app's scroll container with GSAP ScrollToPlugin.
 * ScrollSmoother is deliberately not used: it replaces native scrolling with a transformed wrapper on
 * the window, which this app (sidebar shell, inner scroller, sticky headers) cannot host. Here the
 * container keeps native scrolling for keyboard, scrollbar, trackpad, find-in-page and anchors, and
 * only wheel steps are smoothed. A glide stops on scrollbar drag, touch or key press. Off under
 * prefers-reduced-motion.
 */
export function SmoothScroll({ container }: { container: RefObject<HTMLElement | null> }) {
  // useEffect rather than useGSAP: the container is a later sibling, so its ref is only attached after layout effects.
  useEffect(() => {
    const page = container.current;
    if (!page || !canMatchMedia()) return;

    const mm = gsap.matchMedia();
    mm.add(MOTION_QUERIES.full, () => {
      let gliding = false;
      let goal = 0;
      const stop = () => {
        gliding = false;
      };
      // Scrollbar drag, touch and keyboard take over from a running glide immediately.
      const interrupt = () => {
        if (!gliding) return;
        gsap.killTweensOf(page);
        stop();
      };

      const onWheel = (event: WheelEvent) => {
        const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
        if (event.defaultPrevented || event.ctrlKey || horizontal || !isMouseWheel(event)) return;
        if (innerScrollerTakes(event.target, page, event.deltaY)) return;

        const max = page.scrollHeight - page.clientHeight;
        if (max <= 0) return;
        const step = event.deltaMode === 1 ? event.deltaY * LINE_PX : event.deltaMode === 2 ? event.deltaY * page.clientHeight : event.deltaY;
        // Keep stacking steps on the previous goal until the glide ends or is interrupted (a tween created
        // in this frame is not "active" yet, so track it ourselves), otherwise start from where the page is.
        goal = clamp((gliding ? goal : page.scrollTop) + step, max);
        event.preventDefault();
        gsap.to(page, { scrollTo: { y: goal }, duration: gsapTokens.scroll.duration, ease: 'power3.out', overwrite: true, onComplete: stop, onInterrupt: stop });
        gliding = true;
      };

      page.addEventListener('wheel', onWheel, { passive: false });
      page.addEventListener('pointerdown', interrupt);
      page.addEventListener('touchstart', interrupt, { passive: true });
      page.addEventListener('keydown', interrupt);
      return () => {
        page.removeEventListener('wheel', onWheel);
        page.removeEventListener('pointerdown', interrupt);
        page.removeEventListener('touchstart', interrupt);
        page.removeEventListener('keydown', interrupt);
        gsap.killTweensOf(page);
      };
    });
    return () => mm.revert();
  }, [container]);

  return null;
}
