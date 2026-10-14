'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  MotionConfig,
  animate,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  type Variants,
} from 'motion/react';
import { motionTokens, springs } from '@/lib/motion-tokens';

export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: motionTokens.stagger, delayChildren: 0.05 } },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance.md },
  visible: { opacity: 1, y: 0, transition: springs.gentle },
};

export const pressable = {
  whileHover: { y: -1 },
  whileTap: { scale: motionTokens.scale.press },
  transition: springs.snappy,
} as const;

export const MotionLink = motion.create(Link);

export function Reveal({
  children,
  className,
  delay = 0,
  y = motionTokens.distance.lg,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth, delay }}
    >
      {children}
    </motion.div>
  );
}

export function Stagger({
  children,
  className,
  whenInView = false,
}: {
  children: ReactNode;
  className?: string;
  whenInView?: boolean;
}) {
  return whenInView ? (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-40px' }}
    >
      {children}
    </motion.div>
  ) : (
    <motion.div className={className} variants={staggerContainer} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

export function HoverLift({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -3, boxShadow: '0 10px 24px -12px rgba(4, 120, 87, 0.35)' }}
      transition={springs.snappy}
    >
      {children}
    </motion.div>
  );
}

export function AnimatedNumber({
  value,
  format = (n: number) => String(Math.round(n)),
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
    if (!node || !inView || reduce) return;
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
      {format(value)}
    </span>
  );
}

export function GrowBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <motion.div
      className={'h-full origin-left rounded-full ' + (className ?? 'bg-emerald-600')}
      style={{ width: '100%' }}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: Math.max(0, Math.min(100, percent)) / 100 }}
      viewport={{ once: true }}
      transition={{ duration: motionTokens.duration.crawl, ease: motionTokens.easing.smooth, delay: 0.15 }}
    />
  );
}

export function ScrollProgress({ container }: { container: RefObject<HTMLElement | null> }) {
  const { scrollYProgress } = useScroll({ container });
  return (
    <motion.div
      aria-hidden
      style={{ scaleX: scrollYProgress }}
      className="pointer-events-none absolute left-0 right-0 top-16 z-30 h-0.5 origin-left bg-brand"
    />
  );
}

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      className="space-y-6"
      initial={{ opacity: 0, y: motionTokens.distance.sm }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth }}
    >
      {children}
    </motion.div>
  );
}
