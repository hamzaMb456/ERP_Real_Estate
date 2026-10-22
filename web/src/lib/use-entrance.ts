import { useCallback, type Ref } from 'react';
import { canMatchMedia, gsap, MOTION_QUERIES } from '@/lib/gsap';
import { assignRef } from '@/lib/use-control-motion';

// Only what the entrance animates. Never "all": Radix sets its own inline styles on dialog content.
const ENTRANCE_PROPS = 'opacity,transform,translate,rotate,scale,transformOrigin,transformPerspective';

const isClosing = (el: HTMLElement) => el.getAttribute('data-state') === 'closed' || el.hasAttribute('data-closed');

/**
 * Returns a ref callback that plays a GSAP entrance when a Radix overlay (dialog, sheet) mounts.
 * It hangs off the ref, not a mount effect: Radix renders the content one pass after our component
 * (Portal), so the element does not exist yet when an effect would run. The exit stays on Radix's CSS
 * animation so Presence can still unmount on animationend. If the overlay starts closing mid-entrance
 * the tween jumps to its end and clears its inline styles first.
 */
export function useEntrance<T extends HTMLElement>(forwardedRef: Ref<T> | undefined, from: gsap.TweenVars, to: gsap.TweenVars) {
  return useCallback(
    (node: T | null) => {
      assignRef(forwardedRef, node);
      if (!node || !canMatchMedia()) return;

      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES.full, () => {
        // The overlay classes carry a CSS transition on every property. Switch it off while GSAP drives the
        // element, and restore it after the inline values are cleared so the hand-back does not animate.
        node.style.transition = 'none';
        const tween = gsap.fromTo(node, from, {
          ...to,
          clearProps: ENTRANCE_PROPS,
          onComplete: () => {
            void node.offsetWidth;
            node.style.removeProperty('transition');
          },
        });
        const watcher = new MutationObserver(() => {
          if (isClosing(node)) tween.progress(1, false);
        });
        watcher.observe(node, { attributes: true, attributeFilter: ['data-state', 'data-closed'] });
        return () => watcher.disconnect();
      });

      return () => {
        mm.revert();
        assignRef(forwardedRef, null);
      };
    },
    [forwardedRef, from, to],
  );
}
