'use client';

import { useEffect, useRef, type PointerEvent, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MotionConfig,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from 'motion/react';
import { canMatchMedia, getScrollParent, gsap, gsapTokens, MOTION_QUERIES, ScrollTrigger, useGSAP } from '@/lib/gsap';
import { motionTokens, springs } from '@/lib/motion-tokens';
import { useT } from '@/i18n/provider';

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: motionTokens.stagger, delayChildren: 0.05 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance.lg, scale: 0.92 },
  visible: { opacity: 1, y: 0, scale: 1, transition: springs.gentle },
};

export const pressable = {
  whileHover: { y: -1 },
  whileTap: { scale: motionTokens.scale.press },
  transition: springs.snappy,
} as const;

export const MotionLink = motion.create(Link);

/** A block revealed on scroll by the app-wide ScrollStagger (same as ScrollItem). */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return <ScrollItem className={className}>{children}</ScrollItem>;
}

// What reveals on scroll: explicit items, top-level cards (not cards nested in an item or in another
// card) and table body rows. Anything inside a portal (dialogs, menus) is outside the page and untouched.
const SCROLL_TARGETS = [
  '[data-scroll-item]',
  '[data-slot="card"]:not([data-scroll-item] *):not([data-slot="card"] *)',
  'tbody > tr',
].join(',');

/**
 * Mounted once in the app shell. Reveals cards, table rows and ScrollItems on every page as they
 * scroll into view, in small staggered batches (GSAP ScrollTrigger.batch). Elements that mount later
 * (route change, data loading, filters, expanding a section) are picked up by a MutationObserver;
 * triggers for elements that left the page are killed. Items already on screen animate straight away.
 */
export function ScrollStagger({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root || !canMatchMedia()) return;
      const scroller = getScrollParent(root);
      const mm = gsap.matchMedia();
      mm.add(MOTION_QUERIES.full, (context) => {
        const registered = new WeakSet<Element>();
        let triggers: ScrollTrigger[] = [];
        const register = () => {
          triggers = triggers.filter((trigger) => {
            if ((trigger.trigger as Element | undefined)?.isConnected) return true;
            trigger.kill();
            return false;
          });
          const fresh = Array.from(root.querySelectorAll<HTMLElement>(SCROLL_TARGETS)).filter((el) => !registered.has(el));
          if (fresh.length === 0) return;
          fresh.forEach((el) => registered.add(el));
          gsap.set(fresh, { autoAlpha: 0, y: gsapTokens.reveal.distance });
          const created = ScrollTrigger.batch(fresh, {
            scroller,
            start: 'top 96%',
            once: true,
            onEnter: (batch) =>
              gsap.to(batch, {
                autoAlpha: 1,
                y: 0,
                duration: gsapTokens.reveal.duration,
                stagger: gsapTokens.reveal.stagger,
                ease: gsapTokens.reveal.ease,
                overwrite: true,
                clearProps: 'opacity,visibility,transform',
              }),
          });
          triggers = triggers.concat(created);
        };
        register();
        // Later batches run through context.add so matchMedia still reverts them. Not useGSAP's contextSafe:
        // calling that from inside this matchMedia context nests the two contexts in a loop (stack overflow).
        const observer = new MutationObserver(() => context.add(register));
        observer.observe(root, { childList: true, subtree: true });
        return () => observer.disconnect();
      });
      return () => mm.revert();
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** One block revealed by the nearest ScrollStagger. */
export function ScrollItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-scroll-item="" className={className}>
      {children}
    </div>
  );
}

/** Layout wrapper kept for existing pages; the reveal itself comes from the app-wide ScrollStagger. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return <ScrollItem className={className}>{children}</ScrollItem>;
}

const TILT_DEGREES = 8;
const TILT_SPRING = { stiffness: 220, damping: 20, mass: 0.6 };

/** Card that lifts, scales and tilts in 3D toward the pointer. */
export function HoverLift({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const rotateX = useSpring(useTransform(pointerY, [-0.5, 0.5], [TILT_DEGREES, -TILT_DEGREES]), TILT_SPRING);
  const rotateY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-TILT_DEGREES, TILT_DEGREES]), TILT_SPRING);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType === 'touch') return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - box.left) / box.width - 0.5);
    pointerY.set((event.clientY - box.top) / box.height - 0.5);
  }

  function handlePointerLeave() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <motion.div
      className={'transition-shadow duration-300 hover:shadow-2xl ' + (className ?? '')}
      style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={springs.snappy}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </motion.div>
  );
}

export function Pulse({
  className,
  delay = 0,
  children,
}: {
  className?: string;
  delay?: number;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.4, repeat: Infinity, delay, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

export function SkeletonList({
  count,
  itemClassName,
  className,
  label,
}: {
  count: number;
  itemClassName: string;
  className?: string;
  label?: string;
}) {
  const t = useT();
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label ?? t.common.loading}</span>
      {Array.from({ length: count }, (_, index) => (
        <Pulse key={index} className={itemClassName} delay={index * 0.1} />
      ))}
    </div>
  );
}

const defaultFormat = (n: number) => String(Math.round(n));

export function AnimatedNumber({
  value,
  format = defaultFormat,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      node.textContent = format(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, value, {
      duration: motionTokens.duration.crawl,
      ease: motionTokens.easing.smooth,
      onUpdate: (latest) => {
        node.textContent = format(latest);
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, format]);

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  );
}

export function GrowBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <motion.div
      className={'h-full origin-left rounded-full ' + (className ?? 'bg-primary')}
      style={{ width: '100%' }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: Math.max(0, Math.min(100, percent)) / 100 }}
      viewport={{ once: true }}
      transition={{ duration: motionTokens.duration.crawl, ease: motionTokens.easing.smooth, delay: 0.15 }}
    />
  );
}

/** Reading-progress bar for the app's scroll container, scrubbed by GSAP ScrollTrigger. */
export function ScrollProgress({ container }: { container: RefObject<HTMLElement | null> }) {
  const bar = useRef<HTMLDivElement>(null);

  // useEffect rather than useGSAP: the container is a later sibling, so its ref is only attached once layout effects have run.
  useEffect(() => {
    const scroller = container.current;
    const el = bar.current;
    if (!scroller || !el || !canMatchMedia()) return;
    const mm = gsap.matchMedia();
    mm.add({ full: MOTION_QUERIES.full, reduced: MOTION_QUERIES.reduced }, (context) => {
      gsap.fromTo(
        el,
        { scaleX: 0 },
        { scaleX: 1, ease: 'none', scrollTrigger: { scroller, start: 0, end: 'max', scrub: context.conditions?.reduced ? true : gsapTokens.scroll.scrub } },
      );
    });
    return () => mm.revert();
  }, [container]);

  return (
    <div
      ref={bar}
      aria-hidden
      className="pointer-events-none absolute left-0 right-0 top-14 z-30 h-0.5 origin-left scale-x-0 bg-primary"
    />
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      className="space-y-6"
      initial={{ opacity: 0, y: motionTokens.distance.lg, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth }}
    >
      {children}
    </motion.div>
  );
}
