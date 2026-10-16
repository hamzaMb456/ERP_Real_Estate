import { describe, expect, it } from 'vitest';
import { contrast, ensureContrast, hexToOklch, hueDistance, normalizeHex, oklchToHex } from './color';

describe('color', () => {
  it('round-trips hex through OKLCH', () => {
    for (const hex of ['#0f766e', '#d62828', '#404e60', '#ffffff', '#000000']) {
      const oklch = hexToOklch(hex);
      expect(oklch).not.toBeNull();
      expect(oklchToHex(oklch!)).toBe(hex);
    }
  });

  it('normalises and rejects hex input', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('0F766E')).toBe('#0f766e');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('red')).toBeNull();
  });

  it('computes WCAG contrast', () => {
    const black = hexToOklch('#000000')!;
    const white = hexToOklch('#ffffff')!;
    expect(contrast(black, white)).toBeCloseTo(21, 0);
    expect(contrast(white, white)).toBeCloseTo(1, 5);
  });

  it('moves a colour until it reaches the contrast, keeping hue', () => {
    const white = hexToOklch('#ffffff')!;
    const pale = hexToOklch('#9be3c9')!;
    const result = ensureContrast(pale, white, 4.5);
    expect(result.adjusted).toBe(true);
    expect(contrast(result.color, white)).toBeGreaterThanOrEqual(4.5);
    expect(hueDistance(result.color.h, pale.h)).toBeLessThan(1);
    expect(ensureContrast(result.color, white, 4.5).adjusted).toBe(false);
  });

  it('measures hue distance around the wheel', () => {
    expect(hueDistance(350, 10)).toBe(20);
    expect(hueDistance(90, 270)).toBe(180);
  });
});
