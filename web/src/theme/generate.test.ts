import { describe, expect, it } from 'vitest';
import { contrast, hexToOklch, type Oklch } from './color';
import { generateTheme } from './generate';
import { PALETTES, seedOf } from './palettes';

const STATUS_TOKENS = ['--destructive', '--success', '--warning', '--info'];

function parse(value: string): Oklch {
  const [l, c, h] = value.replace('oklch(', '').replace(')', '').split('/')[0].trim().split(/\s+/).map(Number);
  return { l, c, h };
}

describe('generateTheme', () => {
  it.each(PALETTES.map((palette) => [palette.id, palette] as const))('%s defines a complete token set', (_id, palette) => {
    const theme = generateTheme(palette.seed);
    expect(Object.keys(theme.light).sort()).toEqual(Object.keys(theme.dark).sort());
    for (const key of ['--background', '--primary', '--sidebar-panel', '--sidebar-active-from', '--chart-5', '--theme-hue']) {
      expect(theme.light[key]).toBeTruthy();
    }
    expect(theme.css).toContain('html:root{');
    expect(theme.css).toContain('html.dark{');
  });

  it.each(PALETTES.map((palette) => [palette.id, palette] as const))('%s keeps text and primary readable (AA)', (_id, palette) => {
    const theme = generateTheme(palette.seed);
    for (const mode of ['light', 'dark'] as const) {
      const tokens = theme[mode];
      expect(contrast(parse(tokens['--foreground']), parse(tokens['--background']))).toBeGreaterThanOrEqual(7);
      expect(contrast(parse(tokens['--muted-foreground']), parse(tokens['--background']))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parse(tokens['--primary']), parse(tokens['--card']))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parse(tokens['--primary-foreground']), parse(tokens['--primary']))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('never generates status colours, so they keep their meaning', () => {
    const theme = generateTheme(PALETTES[1].seed);
    for (const key of STATUS_TOKENS) {
      expect(theme.light[key]).toBeUndefined();
      expect(theme.dark[key]).toBeUndefined();
    }
  });

  it('reproduces the EAM Green defaults of globals.css closely', () => {
    const theme = generateTheme(PALETTES[0].seed);
    const primary = parse(theme.light['--primary']);
    expect(primary.l).toBeCloseTo(0.508, 1);
    expect(primary.c).toBeCloseTo(0.118, 1);
    expect(Math.abs(primary.h - 165.6)).toBeLessThan(5);
    expect(theme.primaryAdjusted).toBe(false);
  });

  it('follows a custom primary and flags when it had to be adjusted', () => {
    const base = seedOf({ baseId: 'ocean-blue', overrides: {} });
    expect(generateTheme({ ...base, primary: '#ffe08a' }).primaryAdjusted).toBe(true);
    const red = generateTheme({ ...base, primary: '#d62828' });
    expect(Number(red.light['--theme-hue'])).toBeCloseTo(hexToOklch('#d62828')!.h, 0);
  });

  it('falls back to the default colours on invalid hex', () => {
    const theme = generateTheme({ primary: 'nope', background: 'nope' });
    expect(theme.light['--primary']).toMatch(/^oklch\(/);
  });

  it('keeps categorical chart hues distinct', () => {
    const theme = generateTheme(PALETTES.find((palette) => palette.id === 'warm-amber')!.seed);
    const hues = ['--chart-2', '--chart-3', '--chart-4', '--chart-5'].map((key) => parse(theme.light[key]).h);
    expect(new Set(hues).size).toBe(4);
  });
});
