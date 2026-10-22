import { createRef } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { stubMotionPreference } from '@/test/motion-media';

const originalMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

// The handler reads layout at event time, so stubbing jsdom's missing layout after mount is enough.
function mountWithLayout() {
  const ref = createRef<HTMLDivElement>();
  render(
    <div ref={ref}>
      <SmoothScroll container={ref} />
    </div>,
  );
  const page = ref.current as HTMLDivElement;
  Object.defineProperty(page, 'scrollHeight', { value: 3000, configurable: true });
  Object.defineProperty(page, 'clientHeight', { value: 800, configurable: true });
  return page;
}

describe('SmoothScroll', () => {
  it('takes over notched mouse-wheel steps with full motion', () => {
    stubMotionPreference('full');
    const page = mountWithLayout();
    const notSwallowed = fireEvent.wheel(page, { deltaY: 100 });
    expect(notSwallowed).toBe(false);
  });

  it('leaves trackpad-sized deltas, ctrl-zoom and horizontal swipes to the browser', () => {
    stubMotionPreference('full');
    const page = mountWithLayout();
    expect(fireEvent.wheel(page, { deltaY: 7.5 })).toBe(true);
    expect(fireEvent.wheel(page, { deltaY: 100, ctrlKey: true })).toBe(true);
    expect(fireEvent.wheel(page, { deltaY: 10, deltaX: 100 })).toBe(true);
  });

  it('does nothing under prefers-reduced-motion', () => {
    stubMotionPreference('reduced');
    const page = mountWithLayout();
    expect(fireEvent.wheel(page, { deltaY: 100 })).toBe(true);
  });
});
